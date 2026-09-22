from __future__ import annotations

import hashlib
import logging
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import urlencode, urlparse

import bcrypt
import jwt
import requests
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pymongo.errors import DuplicateKeyError

from db import get_db, mongo_configured
from mail import mail_configured, send_password_reset_code

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth"])
_bearer = HTTPBearer(auto_error=False)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
STATE_TTL_SECONDS = 600
AUTH_CODE_TTL_SECONDS = 90
ACCESS_TOKEN_DAYS = 30


class GoogleIdTokenRequest(BaseModel):
    id_token: str = Field(min_length=20)


class AuthCodeRequest(BaseModel):
    code: str = Field(min_length=8)


class EmailAuthRequest(BaseModel):
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=8, max_length=72)
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)


class EmailLoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=8, max_length=72)


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=5, max_length=120)


class ResetPasswordRequest(BaseModel):
    email: str = Field(min_length=5, max_length=120)
    code: str = Field(min_length=4, max_length=8)
    password: str = Field(min_length=8, max_length=72)


class UserPatchRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    notifications_enabled: Optional[bool] = None


class HistoryItemIn(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    type: str
    date: str
    question: str
    answer: str


class HistoryPutRequest(BaseModel):
    items: list[HistoryItemIn]


class MeditationFavoritesRequest(BaseModel):
    slugs: list[str] = Field(default_factory=list, max_length=500)

    @field_validator("slugs")
    @classmethod
    def normalize_slugs(cls, values: list[str]) -> list[str]:
        seen: set[str] = set()
        result: list[str] = []
        for value in values:
            slug = str(value).strip().lower()
            if re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug) and slug not in seen:
                seen.add(slug)
                result.append(slug)
        return result


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PASSWORD_RESET_TTL = timedelta(minutes=15)
PASSWORD_RESET_COOLDOWN = timedelta(seconds=60)


def normalize_email(value: str) -> str:
    email = value.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Введите корректный email")
    return email


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def hash_reset_code(email: str, code: str) -> str:
    return hashlib.sha256(f"{email}:{code}".encode("utf-8")).hexdigest()


def display_name_from_email(email: str) -> str:
    local = email.split("@", 1)[0].strip()
    return local[:1].upper() + local[1:] if local else "Гость"


def jwt_secret() -> str:
    secret = (os.getenv("JWT_SECRET") or "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail="JWT_SECRET is not configured")
    return secret


def google_client_id() -> str:
    return (os.getenv("GOOGLE_CLIENT_ID") or "").strip()


def google_client_secret() -> str:
    return (os.getenv("GOOGLE_CLIENT_SECRET") or "").strip()


def google_configured() -> bool:
    return bool(google_client_id() and google_client_secret() and mongo_configured())


def google_callback_uri() -> str:
    explicit = (os.getenv("GOOGLE_REDIRECT_URI") or "").strip()
    if explicit:
        return explicit
    public = (os.getenv("PUBLIC_API_URL") or "").rstrip("/")
    if not public:
        raise HTTPException(
            status_code=503,
            detail="Set PUBLIC_API_URL or GOOGLE_REDIRECT_URI for Google login",
        )
    return f"{public}/api/auth/google/callback"


def allowed_client_ids() -> list[str]:
    ids = [
        google_client_id(),
        (os.getenv("GOOGLE_IOS_CLIENT_ID") or "").strip(),
        (os.getenv("GOOGLE_ANDROID_CLIENT_ID") or "").strip(),
    ]
    return [value for value in ids if value]


def is_allowed_redirect(uri: str) -> bool:
    try:
        parsed = urlparse(uri)
    except Exception:
        return False
    if parsed.scheme in {"frontend", "exp", "exps", "mystix"}:
        return True
    public = (os.getenv("PUBLIC_API_URL") or "").rstrip("/")
    if public and uri.rstrip("/") == f"{public}/admin":
        return True
    allow_localhost = (os.getenv("AUTH_ALLOW_LOCALHOST") or "true").lower() == "true"
    if allow_localhost and parsed.hostname in {"localhost", "127.0.0.1"}:
        return True
    allowlist = [
        item.strip()
        for item in (os.getenv("AUTH_REDIRECT_ALLOWLIST") or "").split(",")
        if item.strip()
    ]
    return any(uri.startswith(origin) for origin in allowlist)


def encode_state(redirect_uri: str) -> str:
    payload = {
        "redirect_uri": redirect_uri,
        "nonce": secrets.token_urlsafe(16),
        "exp": _utcnow() + timedelta(seconds=STATE_TTL_SECONDS),
    }
    return jwt.encode(payload, jwt_secret(), algorithm="HS256")


def decode_state(state: str) -> str:
    try:
        payload = jwt.decode(state, jwt_secret(), algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=400, detail="Недействительный state") from exc
    redirect_uri = payload.get("redirect_uri")
    if not isinstance(redirect_uri, str) or not is_allowed_redirect(redirect_uri):
        raise HTTPException(status_code=400, detail="Недопустимый redirect_uri")
    return redirect_uri


def create_access_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": _utcnow() + timedelta(days=ACCESS_TOKEN_DAYS),
        "iat": _utcnow(),
    }
    return jwt.encode(payload, jwt_secret(), algorithm="HS256")


def public_user(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "email": doc.get("email"),
        "name": doc.get("name") or "Гость",
        "picture": doc.get("picture"),
        "is_pro": bool(doc.get("is_pro")),
        "is_admin": is_admin_user(doc),
        "notifications_enabled": bool(doc.get("notifications_enabled", True)),
        "auth_provider": doc.get("auth_provider") or ("email" if doc.get("password_hash") else "google"),
    }


def redirect_with_params(redirect_uri: str, params: dict[str, str]) -> RedirectResponse:
    separator = "&" if urlparse(redirect_uri).query else "?"
    return RedirectResponse(url=f"{redirect_uri}{separator}{urlencode(params)}", status_code=302)


def verify_google_id_token_value(token: str) -> dict[str, Any]:
    audiences = allowed_client_ids()
    if not audiences:
        raise HTTPException(status_code=503, detail="GOOGLE_CLIENT_ID is not configured")

    request = google_requests.Request()
    info: Optional[dict[str, Any]] = None
    last_error: Optional[Exception] = None
    for audience in audiences:
        try:
            info = google_id_token.verify_oauth2_token(
                token,
                request,
                audience,
                clock_skew_in_seconds=10,
            )
            break
        except Exception as exc:
            last_error = exc

    if info is None:
        logger.info("Google id_token verification failed: %s", last_error)
        raise HTTPException(status_code=401, detail="Недействительный Google-токен") from last_error

    issuers = {"accounts.google.com", "https://accounts.google.com"}
    if info.get("iss") not in issuers:
        raise HTTPException(status_code=401, detail="Недействительный Google-токен")
    if not info.get("email"):
        raise HTTPException(status_code=401, detail="Google не вернул email")
    return info


async def upsert_google_user(info: dict[str, Any]) -> dict[str, Any]:
    db = get_db()
    google_id = info["sub"]
    now = _utcnow()
    name = (info.get("given_name") or info.get("name") or "Гость").strip()
    await db.users.update_one(
        {"google_id": google_id},
        {
            "$set": {
                "google_id": google_id,
                "email": info.get("email"),
                "picture": info.get("picture"),
                "auth_provider": "google",
                "updated_at": now,
                "last_login_at": now,
            },
            "$setOnInsert": {
                "name": name,
                "is_pro": False,
                "notifications_enabled": True,
                "created_at": now,
            },
        },
        upsert=True,
    )
    user = await db.users.find_one({"google_id": google_id})
    if not user:
        raise HTTPException(status_code=500, detail="Не удалось сохранить пользователя")
    return user


async def issue_login_code(user: dict[str, Any]) -> str:
    db = get_db()
    code = secrets.token_urlsafe(24)
    await db.auth_codes.insert_one(
        {
            "code": code,
            "user_id": user["_id"],
            "expires_at": _utcnow() + timedelta(seconds=AUTH_CODE_TTL_SECONDS),
        }
    )
    return code


async def consume_login_code(code: str) -> dict[str, Any]:
    db = get_db()
    record = await db.auth_codes.find_one({"code": code})
    if not record:
        raise HTTPException(status_code=400, detail="Код авторизации недействителен")
    expires_at = record.get("expires_at")
    if expires_at is None:
        raise HTTPException(status_code=400, detail="Код авторизации недействителен")
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < _utcnow():
        await db.auth_codes.delete_one({"_id": record["_id"]})
        raise HTTPException(status_code=400, detail="Код авторизации истёк")
    user = await db.users.find_one({"_id": record["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Нужна авторизация")
    try:
        payload = jwt.decode(credentials.credentials, jwt_secret(), algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Сессия истекла, войдите снова") from exc
    user_id = payload.get("sub")
    if not user_id or not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=401, detail="Сессия истекла, войдите снова")
    user = await get_db().users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="Сессия истекла, войдите снова")
    return user


def admin_emails() -> set[str]:
    return {
        item.strip().lower()
        for item in (os.getenv("ADMIN_EMAILS") or "").split(",")
        if item.strip()
    }


def is_admin_user(user: dict[str, Any]) -> bool:
    email = str(user.get("email") or "").strip().lower()
    return bool(user.get("is_admin")) or bool(email and email in admin_emails())


async def get_current_admin(
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Нет доступа к админ-панели")
    return user


def session_payload(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "access_token": create_access_token(str(user["_id"])),
        "token_type": "bearer",
        "user": public_user(user),
    }


def exchange_google_code(code: str) -> dict[str, Any]:
    try:
        response = requests.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": google_client_id(),
                "client_secret": google_client_secret(),
                "redirect_uri": google_callback_uri(),
                "grant_type": "authorization_code",
            },
            timeout=20,
        )
    except requests.RequestException as exc:
        logger.exception("Google token exchange failed")
        raise HTTPException(status_code=502, detail="Google временно недоступен") from exc

    if response.status_code >= 400:
        logger.info("Google token error %s: %s", response.status_code, response.text[:400])
        raise HTTPException(status_code=401, detail="Не удалось подтвердить вход Google")

    data = response.json()
    id_token_value = data.get("id_token")
    if not isinstance(id_token_value, str):
        raise HTTPException(status_code=401, detail="Google не вернул id_token")
    return verify_google_id_token_value(id_token_value)


@router.get("/auth/config")
async def auth_config():
    return {
        "google": google_configured(),
        "email": mongo_configured(),
        "mail": mail_configured(),
        "mongo": mongo_configured(),
    }


@router.post("/auth/email/register")
async def email_register(body: EmailAuthRequest):
    if not mongo_configured():
        raise HTTPException(status_code=503, detail="База данных недоступна")
    email = normalize_email(body.email)
    db = get_db()
    existing = await db.users.find_one({"email": email})
    if existing:
        if existing.get("password_hash"):
            raise HTTPException(status_code=409, detail="Такой email уже зарегистрирован")
        raise HTTPException(
            status_code=409,
            detail="Этот email уже привязан к Google. Войдите через Google",
        )

    now = _utcnow()
    name = (body.name or "").strip() or display_name_from_email(email)
    doc = {
        "email": email,
        "name": name,
        "password_hash": hash_password(body.password),
        "auth_provider": "email",
        "picture": None,
        "is_pro": False,
        "notifications_enabled": True,
        "created_at": now,
        "updated_at": now,
        "last_login_at": now,
    }
    try:
        result = await db.users.insert_one(doc)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="Такой email уже зарегистрирован") from exc
    user = await db.users.find_one({"_id": result.inserted_id})
    if not user:
        raise HTTPException(status_code=500, detail="Не удалось создать аккаунт")
    return session_payload(user)


@router.post("/auth/email/login")
async def email_login(body: EmailLoginRequest):
    if not mongo_configured():
        raise HTTPException(status_code=503, detail="База данных недоступна")
    email = normalize_email(body.email)
    user = await get_db().users.find_one({"email": email})
    if not user or not user.get("password_hash"):
        if user and user.get("auth_provider") == "google":
            raise HTTPException(
                status_code=400,
                detail="Этот email привязан к Google. Войдите через Google",
            )
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    await get_db().users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login_at": _utcnow(), "updated_at": _utcnow()}},
    )
    return session_payload(user)


@router.post("/auth/email/forgot")
async def email_forgot(body: ForgotPasswordRequest):
    email = normalize_email(body.email)
    if not mail_configured():
        raise HTTPException(status_code=503, detail="Отправка писем ещё не настроена")
    db = get_db()
    user = await db.users.find_one({"email": email})
    # Same response whether the user exists, to avoid leaking accounts.
    if user and user.get("password_hash"):
        latest = await db.password_resets.find_one(
            {"email": email},
            sort=[("created_at", -1)],
        )
        if latest:
            created_at = latest.get("created_at")
            if isinstance(created_at, datetime):
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                if _utcnow() - created_at < PASSWORD_RESET_COOLDOWN:
                    return {"ok": True}

        code = f"{secrets.randbelow(1_000_000):06d}"
        await db.password_resets.insert_one(
            {
                "email": email,
                "code_hash": hash_reset_code(email, code),
                "created_at": _utcnow(),
                "expires_at": _utcnow() + PASSWORD_RESET_TTL,
            }
        )
        try:
            await run_in_threadpool(send_password_reset_code, email, code)
        except Exception:
            logger.exception("Password reset email failed")
            raise HTTPException(status_code=502, detail="Не удалось отправить письмо")
    return {"ok": True}


@router.post("/auth/email/reset")
async def email_reset(body: ResetPasswordRequest):
    email = normalize_email(body.email)
    code = body.code.strip()
    db = get_db()
    record = await db.password_resets.find_one(
        {"email": email, "code_hash": hash_reset_code(email, code)},
        sort=[("created_at", -1)],
    )
    if not record:
        raise HTTPException(status_code=400, detail="Неверный или истекший код")
    expires_at = record.get("expires_at")
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if not isinstance(expires_at, datetime) or expires_at < _utcnow():
        await db.password_resets.delete_one({"_id": record["_id"]})
        raise HTTPException(status_code=400, detail="Код истек, запросите новый")

    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=400, detail="Неверный или истекший код")

    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_hash": hash_password(body.password),
                "updated_at": _utcnow(),
            }
        },
    )
    await db.password_resets.delete_many({"email": email})
    return session_payload(user)


@router.get("/auth/google/start")
async def google_start(redirect_uri: str = Query(..., min_length=4)):
    if not google_configured():
        raise HTTPException(status_code=503, detail="Вход через Google ещё не настроен")
    get_db()
    if not is_allowed_redirect(redirect_uri):
        raise HTTPException(status_code=400, detail="Недопустимый redirect_uri")

    params = {
        "client_id": google_client_id(),
        "redirect_uri": google_callback_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": encode_state(redirect_uri),
        "prompt": "select_account",
        "access_type": "online",
    }
    return RedirectResponse(url=f"{GOOGLE_AUTH_URL}?{urlencode(params)}", status_code=302)


@router.get("/auth/google/callback")
async def google_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
):
    redirect_uri = "frontend://auth"
    try:
        if state:
            redirect_uri = decode_state(state)
        if error:
            return redirect_with_params(redirect_uri, {"error": "cancelled"})
        if not code or not state:
            return redirect_with_params(redirect_uri, {"error": "missing_code"})
        info = await run_in_threadpool(exchange_google_code, code)
        user = await upsert_google_user(info)
        login_code = await issue_login_code(user)
        return redirect_with_params(redirect_uri, {"code": login_code})
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, str) else "auth_failed"
        logger.info("Google callback failed: %s", detail)
        return redirect_with_params(redirect_uri, {"error": "auth_failed"})
    except Exception:
        logger.exception("Google callback failed")
        return redirect_with_params(redirect_uri, {"error": "auth_failed"})


@router.post("/auth/google/exchange")
async def google_exchange(body: AuthCodeRequest):
    user = await consume_login_code(body.code)
    return session_payload(user)


@router.post("/auth/google")
async def google_id_token_login(body: GoogleIdTokenRequest):
    if not mongo_configured():
        raise HTTPException(status_code=503, detail="База данных недоступна")
    info = await run_in_threadpool(verify_google_id_token_value, body.id_token)
    user = await upsert_google_user(info)
    return session_payload(user)


@router.get("/me")
async def me(user: dict[str, Any] = Depends(get_current_user)):
    return public_user(user)


@router.patch("/me")
async def patch_me(body: UserPatchRequest, user: dict[str, Any] = Depends(get_current_user)):
    updates: dict[str, Any] = {"updated_at": _utcnow()}
    if body.name is not None:
        updates["name"] = body.name.strip()
    if body.notifications_enabled is not None:
        updates["notifications_enabled"] = body.notifications_enabled
    if len(updates) > 1:
        await get_db().users.update_one({"_id": user["_id"]}, {"$set": updates})
        user = await get_db().users.find_one({"_id": user["_id"]}) or user
    return public_user(user)


async def _published_favorite_slugs(user: dict[str, Any]) -> list[str]:
    raw = [
        str(slug)
        for slug in (user.get("favorite_meditations") or [])
        if isinstance(slug, str)
    ]
    if not raw:
        return []
    valid = set(
        await get_db().meditations.distinct(
            "slug",
            {
                "slug": {"$in": raw},
                "published": True,
                "deleted": {"$ne": True},
            },
        )
    )
    return [slug for slug in raw if slug in valid]


@router.get("/me/meditation-favorites")
async def get_meditation_favorites(
    user: dict[str, Any] = Depends(get_current_user),
):
    return {"slugs": await _published_favorite_slugs(user)}


@router.post("/me/meditation-favorites/merge")
async def merge_meditation_favorites(
    body: MeditationFavoritesRequest,
    user: dict[str, Any] = Depends(get_current_user),
):
    valid = (
        await get_db()
        .meditations.find(
            {
                "slug": {"$in": body.slugs},
                "published": True,
                "deleted": {"$ne": True},
            },
            {"slug": 1},
        )
        .to_list(length=500)
    )
    slugs = [str(doc["slug"]) for doc in valid]
    if slugs:
        await get_db().users.update_one(
            {"_id": user["_id"]},
            {
                "$addToSet": {"favorite_meditations": {"$each": slugs}},
                "$set": {"updated_at": _utcnow()},
            },
        )
        user = await get_db().users.find_one({"_id": user["_id"]}) or user
    return {"slugs": await _published_favorite_slugs(user)}


@router.put("/me/meditation-favorites/{slug}")
async def add_meditation_favorite(
    slug: str,
    user: dict[str, Any] = Depends(get_current_user),
):
    slug_n = slug.strip().lower()
    meditation = await get_db().meditations.find_one(
        {
            "slug": slug_n,
            "published": True,
            "deleted": {"$ne": True},
        },
        {"_id": 1},
    )
    if not meditation:
        raise HTTPException(status_code=404, detail="Медитация не найдена")
    await get_db().users.update_one(
        {"_id": user["_id"]},
        {
            "$addToSet": {"favorite_meditations": slug_n},
            "$set": {"updated_at": _utcnow()},
        },
    )
    return {"slug": slug_n, "favorite": True}


@router.delete("/me/meditation-favorites/{slug}")
async def remove_meditation_favorite(
    slug: str,
    user: dict[str, Any] = Depends(get_current_user),
):
    slug_n = slug.strip().lower()
    await get_db().users.update_one(
        {"_id": user["_id"]},
        {
            "$pull": {"favorite_meditations": slug_n},
            "$set": {"updated_at": _utcnow()},
        },
    )
    return {"slug": slug_n, "favorite": False}


@router.get("/me/history")
async def get_history(user: dict[str, Any] = Depends(get_current_user)):
    return {"items": await _history_items_for_user(user["_id"])}


async def _history_items_for_user(user_id: ObjectId) -> list[dict[str, Any]]:
    docs = (
        await get_db()
        .history.find({"user_id": user_id})
        .sort("item.date", -1)
        .max_time_ms(8000)
        .to_list(length=2000)
    )
    return [doc["item"] for doc in docs if isinstance(doc.get("item"), dict)]


@router.post("/me/history/merge")
async def merge_history(
    body: HistoryPutRequest,
    user: dict[str, Any] = Depends(get_current_user),
):
    """Add missing client items without replacing existing account history."""
    db = get_db()
    unique_items: dict[str, dict[str, Any]] = {}
    for item in body.items:
        dumped = item.model_dump()
        unique_items.setdefault(dumped["id"], dumped)

    for item in unique_items.values():
        try:
            await db.history.update_one(
                {"user_id": user["_id"], "item.id": item["id"]},
                {"$setOnInsert": {"user_id": user["_id"], "item": item}},
                upsert=True,
            )
        except DuplicateKeyError:
            # A concurrent/retried merge inserted the same item first.
            pass

    items = await _history_items_for_user(user["_id"])
    return {"items": items, "count": len(items)}


@router.put("/me/history")
async def put_history(body: HistoryPutRequest, user: dict[str, Any] = Depends(get_current_user)):
    db = get_db()
    items = [item.model_dump() for item in body.items]
    await db.history.delete_many({"user_id": user["_id"]})
    if items:
        await db.history.insert_many(
            [{"user_id": user["_id"], "item": item} for item in items]
        )
    return {"items": items, "count": len(items)}
