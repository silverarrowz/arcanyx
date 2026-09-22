from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator

from auth import get_optional_user, normalize_email
from db import get_db, mongo_configured
from mail import (
    mail_configured,
    send_support_notification,
    support_recipient,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["support"])

SupportCategory = Literal["technical", "account", "content", "idea", "other"]

CATEGORY_LABELS: dict[str, str] = {
    "technical": "Техническая проблема",
    "account": "Аккаунт",
    "content": "Расклады и контент",
    "idea": "Идея или пожелание",
    "other": "Другое",
}

RATE_WINDOW = timedelta(hours=1)
IDENTITY_RATE_LIMIT = 5
ADDRESS_RATE_LIMIT = 20


class SupportRequestBody(BaseModel):
    category: SupportCategory
    email: Optional[str] = Field(default=None, max_length=120)
    message: str = Field(min_length=10, max_length=3000)
    platform: Optional[str] = Field(default=None, max_length=30)
    app_version: Optional[str] = Field(default=None, max_length=40)

    @field_validator("message", mode="before")
    @classmethod
    def normalize_message(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @field_validator("email", "platform", "app_version", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: Any) -> Any:
        if not isinstance(value, str):
            return value
        value = value.strip()
        return value or None


class SupportResponse(BaseModel):
    id: str
    status: Literal["received"] = "received"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _address_hash(request: Request) -> Optional[str]:
    address = request.client.host.strip() if request.client and request.client.host else ""
    if not address:
        return None
    salt = (os.getenv("JWT_SECRET") or "arcanyx-support").strip()
    return hashlib.sha256(f"{salt}:support:{address}".encode("utf-8")).hexdigest()


async def _enforce_rate_limit(
    *,
    user: Optional[dict[str, Any]],
    email: str,
    address_hash: Optional[str],
) -> None:
    db = get_db()
    since = _utcnow() - RATE_WINDOW
    identity_filter: dict[str, Any]
    if user is not None:
        identity_filter = {"user_id": user["_id"]}
    else:
        identity_filter = {"email": email}

    identity_count = await db.support_requests.count_documents(
        {**identity_filter, "created_at": {"$gte": since}},
    )
    if identity_count >= IDENTITY_RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Слишком много обращений. Попробуйте снова через час.",
        )

    if address_hash:
        address_count = await db.support_requests.count_documents(
            {"ip_hash": address_hash, "created_at": {"$gte": since}},
        )
        if address_count >= ADDRESS_RATE_LIMIT:
            raise HTTPException(
                status_code=429,
                detail="Слишком много обращений. Попробуйте снова через час.",
            )


def _send_notification_safely(
    *,
    recipient: str,
    request_id: str,
    category: str,
    email: str,
    message: str,
    user_id: Optional[str],
    user_name: Optional[str],
    platform: Optional[str],
    app_version: Optional[str],
) -> None:
    try:
        send_support_notification(
            to=recipient,
            request_id=request_id,
            category=category,
            email=email,
            message=message,
            user_id=user_id,
            user_name=user_name,
            platform=platform,
            app_version=app_version,
        )
    except Exception:
        logger.exception("Support notification failed | request_id=%s", request_id)


@router.post(
    "/support",
    response_model=SupportResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_support_request(
    body: SupportRequestBody,
    request: Request,
    background_tasks: BackgroundTasks,
    user: Optional[dict[str, Any]] = Depends(get_optional_user),
) -> SupportResponse:
    if not mongo_configured():
        raise HTTPException(
            status_code=503,
            detail="Поддержка временно недоступна. Попробуйте позже.",
        )

    candidate_email = body.email or (str(user.get("email") or "") if user else "")
    if not candidate_email:
        raise HTTPException(status_code=400, detail="Введите email для ответа")
    email = normalize_email(candidate_email)
    address_hash = _address_hash(request)

    await _enforce_rate_limit(user=user, email=email, address_hash=address_hash)

    created_at = _utcnow()
    document = {
        "user_id": user["_id"] if user else None,
        "email": email,
        "name": str(user.get("name") or "").strip() or None if user else None,
        "category": body.category,
        "message": body.message,
        "platform": body.platform,
        "app_version": body.app_version,
        "ip_hash": address_hash,
        "status": "new",
        "created_at": created_at,
        "updated_at": created_at,
    }
    result = await get_db().support_requests.insert_one(document)
    request_id = str(result.inserted_id)

    recipient = support_recipient()
    if recipient and mail_configured():
        background_tasks.add_task(
            _send_notification_safely,
            recipient=recipient,
            request_id=request_id,
            category=CATEGORY_LABELS[body.category],
            email=email,
            message=body.message,
            user_id=str(user["_id"]) if user else None,
            user_name=document["name"],
            platform=body.platform,
            app_version=body.app_version,
        )
    else:
        logger.warning(
            "Support request saved without email notification | request_id=%s",
            request_id,
        )

    return SupportResponse(id=request_id)
