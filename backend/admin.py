from __future__ import annotations

import os
import logging
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, RedirectResponse
from mutagen import File as MutagenFile
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field, field_validator
from pymongo.errors import DuplicateKeyError

from auth import get_current_admin, public_user
from db import get_db
from meditations import cache_uploaded_audio, cache_uploaded_cover
from storage import (
    s3_configured,
    storage_status,
    upload_path,
    versioned_object_key,
)


router = APIRouter(prefix="/admin", tags=["admin"])
page_router = APIRouter(include_in_schema=False)
STATIC_DIR = Path(__file__).parent / "static" / "admin"
logger = logging.getLogger(__name__)
AUDIO_SUFFIXES = {".mp3"}
COVER_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _limit_bytes(env_name: str, default_mb: int) -> int:
    try:
        value = max(1, int(os.getenv(env_name) or default_mb))
    except ValueError:
        value = default_mb
    return value * 1024 * 1024


class MeditationDraftIn(BaseModel):
    slug: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=8000)
    tags: list[str] = Field(default_factory=list, max_length=20)
    sort: int = Field(default=0, ge=-10000, le=10000)

    @field_validator("slug", "title", "description", mode="before")
    @classmethod
    def strip_text(cls, value: Any) -> str:
        return str(value or "").strip()

    @field_validator("tags", mode="before")
    @classmethod
    def normalize_tags(cls, value: Any) -> list[str]:
        if isinstance(value, str):
            value = value.split(",")
        if not isinstance(value, list):
            return []
        seen: set[str] = set()
        tags: list[str] = []
        for raw in value:
            tag = str(raw).strip()
            key = tag.lower()
            if tag and key not in seen:
                seen.add(key)
                tags.append(tag[:60])
        return tags


class ReorderIn(BaseModel):
    slugs: list[str] = Field(min_length=1, max_length=500)


class RollbackIn(BaseModel):
    version: str = Field(min_length=1, max_length=200)


def _json_value(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _json_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_value(item) for item in value]
    return value


def _admin_item(doc: dict[str, Any]) -> dict[str, Any]:
    return _json_value(
        {
            "id": doc.get("_id"),
            "slug": doc.get("slug"),
            "title": doc.get("title") or "",
            "description": doc.get("description") or "",
            "tags": doc.get("tags") or [],
            "sort": int(doc.get("sort") or 0),
            "published": bool(doc.get("published")),
            "audio": doc.get("audio"),
            "cover": doc.get("cover"),
            "audioVersions": doc.get("audioVersions") or [],
            "coverVersions": doc.get("coverVersions") or [],
            "createdAt": doc.get("createdAt"),
            "updatedAt": doc.get("updatedAt"),
            "publishedAt": doc.get("publishedAt"),
        }
    )


async def _document(slug: str) -> dict[str, Any]:
    doc = await get_db().meditations.find_one({"slug": slug, "deleted": {"$ne": True}})
    if not doc:
        raise HTTPException(status_code=404, detail="Медитация не найдена")
    return doc


async def _save_upload(upload: UploadFile, *, max_bytes: int, suffixes: set[str]) -> Path:
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix not in suffixes:
        raise HTTPException(status_code=400, detail="Неподдерживаемый тип файла")
    fd, filename = tempfile.mkstemp(prefix="mystix-upload-", suffix=suffix)
    os.close(fd)
    path = Path(filename)
    total = 0
    try:
        with path.open("wb") as handle:
            while chunk := await upload.read(1024 * 1024):
                total += len(chunk)
                if total > max_bytes:
                    raise HTTPException(status_code=413, detail="Файл слишком большой")
                handle.write(chunk)
        if total < 1000:
            raise HTTPException(status_code=400, detail="Файл пуст или повреждён")
        return path
    except Exception:
        path.unlink(missing_ok=True)
        raise
    finally:
        await upload.close()


def _audio_metadata(path: Path) -> dict[str, Any]:
    try:
        media = MutagenFile(path)
        duration = float(media.info.length) if media and media.info else 0
    except Exception as exc:
        raise ValueError("Не удалось прочитать MP3") from exc
    if duration <= 0:
        raise ValueError("MP3 не содержит корректной аудиодорожки")
    return {"durationSec": max(1, int(round(duration)))}


def _normalize_cover(path: Path) -> dict[str, Any]:
    normalized = path.with_suffix(".normalized.jpg")
    try:
        with Image.open(path) as source:
            source.verify()
        with Image.open(path) as source:
            if source.width * source.height > 40_000_000:
                raise ValueError("Слишком большое разрешение обложки")
            image = ImageOps.exif_transpose(source)
            if image.mode != "RGB":
                image = image.convert("RGB")
            image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            width, height = image.size
            image.save(normalized, "JPEG", quality=88, optimize=True)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        normalized.unlink(missing_ok=True)
        raise ValueError("Обложка повреждена или имеет неподдерживаемый формат") from exc
    return {"path": normalized, "width": width, "height": height}


def _version_from_upload(meta: dict[str, Any], key: str) -> str:
    etag = str(meta.get("etag") or "")
    object_id = Path(key).stem
    return f"{object_id}-{etag[:16]}" if etag else object_id


@page_router.get("/admin")
@page_router.get("/admin/")
async def admin_page():
    page = STATIC_DIR / "index.html"
    if not page.is_file():
        raise HTTPException(status_code=404, detail="Admin UI is not built")
    return FileResponse(page, media_type="text/html", headers={"Cache-Control": "no-store"})


@page_router.get("/admin/index.html")
async def admin_index_redirect():
    return RedirectResponse("/admin", status_code=307)


@page_router.get("/admin/{asset_name}")
async def admin_asset(asset_name: str):
    if asset_name not in {"admin.css", "admin.js"}:
        raise HTTPException(status_code=404)
    path = STATIC_DIR / asset_name
    return FileResponse(
        path,
        media_type="text/css" if asset_name.endswith(".css") else "text/javascript",
        headers={"Cache-Control": "no-cache"},
    )


@router.get("/status")
async def admin_status(user: dict[str, Any] = Depends(get_current_admin)):
    return {"user": public_user(user), "storage": storage_status()}


@router.get("/meditations")
async def admin_meditations(_user: dict[str, Any] = Depends(get_current_admin)):
    docs = (
        await get_db()
        .meditations.find({"deleted": {"$ne": True}})
        .sort([("sort", 1), ("title", 1)])
        .to_list(length=500)
    )
    return {"items": [_admin_item(doc) for doc in docs]}


@router.post("/meditations", status_code=201)
async def create_meditation(
    body: MeditationDraftIn,
    user: dict[str, Any] = Depends(get_current_admin),
):
    now = _utcnow()
    doc = {
        **body.model_dump(),
        "published": False,
        "deleted": False,
        "audio": None,
        "cover": None,
        "audioVersions": [],
        "coverVersions": [],
        "createdAt": now,
        "updatedAt": now,
        "createdBy": user["_id"],
        "updatedBy": user["_id"],
    }
    try:
        result = await get_db().meditations.insert_one(doc)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="Такой slug уже существует") from exc
    doc["_id"] = result.inserted_id
    return _admin_item(doc)


@router.put("/meditations/{slug}")
async def update_meditation(
    slug: str,
    body: MeditationDraftIn,
    user: dict[str, Any] = Depends(get_current_admin),
):
    doc = await _document(slug)
    if doc.get("published") and body.slug != slug:
        raise HTTPException(
            status_code=409,
            detail="Сначала снимите медитацию с публикации, чтобы изменить slug",
        )
    try:
        await get_db().meditations.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    **body.model_dump(),
                    "updatedAt": _utcnow(),
                    "updatedBy": user["_id"],
                }
            },
        )
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="Такой slug уже существует") from exc
    return _admin_item(await _document(body.slug))


@router.post("/meditations/reorder")
async def reorder_meditations(
    body: ReorderIn,
    user: dict[str, Any] = Depends(get_current_admin),
):
    db = get_db()
    now = _utcnow()
    for position, slug in enumerate(body.slugs):
        await db.meditations.update_one(
            {"slug": slug, "deleted": {"$ne": True}},
            {
                "$set": {
                    "sort": position,
                    "updatedAt": now,
                    "updatedBy": user["_id"],
                }
            },
        )
    return {"ok": True}


@router.delete("/meditations/{slug}")
async def archive_meditation(
    slug: str,
    user: dict[str, Any] = Depends(get_current_admin),
):
    doc = await _document(slug)
    await get_db().meditations.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "published": False,
                "deleted": True,
                "updatedAt": _utcnow(),
                "updatedBy": user["_id"],
            }
        },
    )
    return {"ok": True}


@router.post("/meditations/{slug}/audio")
async def upload_audio(
    slug: str,
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(get_current_admin),
):
    doc = await _document(slug)
    if not s3_configured():
        raise HTTPException(status_code=503, detail=storage_status())
    if (file.content_type or "").lower() not in {
        "audio/mpeg",
        "audio/mp3",
        "application/octet-stream",
    }:
        raise HTTPException(status_code=400, detail="Ожидается MP3-файл")
    path = await _save_upload(
        file,
        max_bytes=_limit_bytes("ADMIN_AUDIO_MAX_MB", 120),
        suffixes=AUDIO_SUFFIXES,
    )
    key = ""
    try:
        try:
            measured = await run_in_threadpool(_audio_metadata, path)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        key = versioned_object_key("audio", slug, ".mp3")
        uploaded = await run_in_threadpool(
            upload_path,
            path,
            key,
            content_type="audio/mpeg",
        )
        uploaded.update(measured)
        uploaded.update(
            {
                "version": _version_from_upload(uploaded, key),
                "createdAt": _utcnow(),
                "createdBy": user["_id"],
                "originalName": file.filename,
            }
        )
        await run_in_threadpool(
            cache_uploaded_audio,
            path,
            key,
            uploaded["version"],
        )
        update: dict[str, Any] = {
            "$set": {
                "audio": uploaded,
                "durationSec": uploaded["durationSec"],
                "updatedAt": _utcnow(),
                "updatedBy": user["_id"],
            }
        }
        if isinstance(doc.get("audio"), dict):
            update["$push"] = {
                "audioVersions": {
                    "$each": [doc["audio"]],
                    "$position": 0,
                    "$slice": 20,
                }
            }
        await get_db().meditations.update_one({"_id": doc["_id"]}, update)
        return _admin_item(await _document(slug))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to upload meditation audio | slug=%s", slug)
        raise HTTPException(status_code=502, detail="Не удалось загрузить аудио в S3") from exc
    finally:
        path.unlink(missing_ok=True)


@router.post("/meditations/{slug}/cover")
async def upload_cover(
    slug: str,
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(get_current_admin),
):
    doc = await _document(slug)
    if not s3_configured():
        raise HTTPException(status_code=503, detail=storage_status())
    if (file.content_type or "").lower() not in {
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/octet-stream",
    }:
        raise HTTPException(status_code=400, detail="Ожидается JPG, PNG или WebP")
    path = await _save_upload(
        file,
        max_bytes=_limit_bytes("ADMIN_COVER_MAX_MB", 12),
        suffixes=COVER_SUFFIXES,
    )
    normalized: Path | None = None
    try:
        try:
            cover = await run_in_threadpool(_normalize_cover, path)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        normalized = cover.pop("path")
        key = versioned_object_key("covers", slug, ".jpg")
        uploaded = await run_in_threadpool(
            upload_path,
            normalized,
            key,
            content_type="image/jpeg",
        )
        uploaded.update(cover)
        uploaded.update(
            {
                "version": _version_from_upload(uploaded, key),
                "createdAt": _utcnow(),
                "createdBy": user["_id"],
                "originalName": file.filename,
            }
        )
        await run_in_threadpool(cache_uploaded_cover, normalized, key)
        update: dict[str, Any] = {
            "$set": {
                "cover": uploaded,
                "updatedAt": _utcnow(),
                "updatedBy": user["_id"],
            }
        }
        if isinstance(doc.get("cover"), dict):
            update["$push"] = {
                "coverVersions": {
                    "$each": [doc["cover"]],
                    "$position": 0,
                    "$slice": 20,
                }
            }
        await get_db().meditations.update_one({"_id": doc["_id"]}, update)
        return _admin_item(await _document(slug))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to upload meditation cover | slug=%s", slug)
        raise HTTPException(status_code=502, detail="Не удалось загрузить обложку в S3") from exc
    finally:
        path.unlink(missing_ok=True)
        if normalized:
            normalized.unlink(missing_ok=True)


@router.post("/meditations/{slug}/publish")
async def publish_meditation(
    slug: str,
    user: dict[str, Any] = Depends(get_current_admin),
):
    doc = await _document(slug)
    missing = [
        name
        for name, value in (
            ("название", doc.get("title")),
            ("аудио", doc.get("audio")),
            ("обложка", doc.get("cover")),
        )
        if not value
    ]
    if missing:
        raise HTTPException(
            status_code=409,
            detail=f"Нельзя опубликовать: отсутствует {', '.join(missing)}",
        )
    now = _utcnow()
    await get_db().meditations.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "published": True,
                "publishedAt": now,
                "updatedAt": now,
                "updatedBy": user["_id"],
            }
        },
    )
    return _admin_item(await _document(slug))


@router.post("/meditations/{slug}/unpublish")
async def unpublish_meditation(
    slug: str,
    user: dict[str, Any] = Depends(get_current_admin),
):
    doc = await _document(slug)
    await get_db().meditations.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "published": False,
                "updatedAt": _utcnow(),
                "updatedBy": user["_id"],
            }
        },
    )
    return _admin_item(await _document(slug))


@router.post("/meditations/{slug}/audio/rollback")
async def rollback_audio(
    slug: str,
    body: RollbackIn,
    user: dict[str, Any] = Depends(get_current_admin),
):
    doc = await _document(slug)
    versions = list(doc.get("audioVersions") or [])
    selected = next(
        (item for item in versions if str(item.get("version")) == body.version),
        None,
    )
    if not selected:
        raise HTTPException(status_code=404, detail="Версия аудио не найдена")
    remaining = [
        item for item in versions if str(item.get("version")) != body.version
    ]
    current = doc.get("audio")
    if isinstance(current, dict):
        remaining.insert(0, current)
    await get_db().meditations.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "audio": selected,
                "audioVersions": remaining[:20],
                "durationSec": int(selected.get("durationSec") or 0),
                "updatedAt": _utcnow(),
                "updatedBy": user["_id"],
            }
        },
    )
    return _admin_item(await _document(slug))


@router.post("/meditations/{slug}/cover/rollback")
async def rollback_cover(
    slug: str,
    body: RollbackIn,
    user: dict[str, Any] = Depends(get_current_admin),
):
    doc = await _document(slug)
    versions = list(doc.get("coverVersions") or [])
    selected = next(
        (item for item in versions if str(item.get("version")) == body.version),
        None,
    )
    if not selected:
        raise HTTPException(status_code=404, detail="Версия обложки не найдена")
    remaining = [
        item for item in versions if str(item.get("version")) != body.version
    ]
    current = doc.get("cover")
    if isinstance(current, dict):
        remaining.insert(0, current)
    await get_db().meditations.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "cover": selected,
                "coverVersions": remaining[:20],
                "updatedAt": _utcnow(),
                "updatedBy": user["_id"],
            }
        },
    )
    return _admin_item(await _document(slug))
