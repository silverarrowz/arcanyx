from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field, field_validator, model_validator
from pymongo.errors import DuplicateKeyError

from admin import (
    COVER_SUFFIXES,
    ReorderIn,
    RollbackIn,
    _json_value,
    _limit_bytes,
    _save_upload,
    _version_from_upload,
)
from auth import get_current_admin
from db import get_db
from storage import (
    s3_configured,
    storage_status,
    upload_path,
    versioned_tarot_spread_cover_key,
)


router = APIRouter(prefix="/admin/tarot-spreads", tags=["admin-tarot-spreads"])
logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SpreadPositionIn(BaseModel):
    id: str = Field(
        min_length=1,
        max_length=80,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )
    labelRu: str = Field(min_length=1, max_length=120)

    @field_validator("id", "labelRu", mode="before")
    @classmethod
    def strip_text(cls, value: Any) -> str:
        return str(value or "").strip()


class TarotSpreadDraftIn(BaseModel):
    slug: str = Field(
        min_length=2,
        max_length=80,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )
    titleRu: str = Field(min_length=1, max_length=180)
    subtitleRu: str = Field(min_length=1, max_length=300)
    positions: list[SpreadPositionIn] = Field(min_length=1, max_length=5)
    sort: int = Field(default=0, ge=-10000, le=10000)

    @field_validator("slug", "titleRu", "subtitleRu", mode="before")
    @classmethod
    def strip_text(cls, value: Any) -> str:
        return str(value or "").strip()

    @model_validator(mode="after")
    def unique_position_ids(self):
        ids = [position.id for position in self.positions]
        if len(ids) != len(set(ids)):
            raise ValueError("ID позиций должны быть уникальными")
        return self


def _admin_item(doc: dict[str, Any]) -> dict[str, Any]:
    positions = [
        {
            "id": str(position.get("id") or ""),
            "labelRu": str(position.get("labelRu") or ""),
        }
        for position in (doc.get("positions") or [])
        if isinstance(position, dict)
    ]
    return _json_value(
        {
            "id": doc.get("_id"),
            "slug": doc.get("slug"),
            "titleRu": doc.get("titleRu") or "",
            "subtitleRu": doc.get("subtitleRu") or "",
            "positions": positions,
            "drawCount": len(positions),
            "sort": int(doc.get("sort") or 0),
            "published": bool(doc.get("published")),
            "cover": doc.get("cover"),
            "coverVersions": doc.get("coverVersions") or [],
            "contentVersion": doc.get("contentVersion") or "",
            "createdAt": doc.get("createdAt"),
            "updatedAt": doc.get("updatedAt"),
            "publishedAt": doc.get("publishedAt"),
        }
    )


async def _document(slug: str) -> dict[str, Any]:
    doc = await get_db().tarot_spreads.find_one(
        {"slug": slug, "deleted": {"$ne": True}}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Расклад не найден")
    return doc


def _normalize_spread_cover(path: Path) -> dict[str, Any]:
    normalized = path.with_suffix(".spread.jpg")
    try:
        with Image.open(path) as source:
            source.verify()
        with Image.open(path) as source:
            if source.width * source.height > 40_000_000:
                raise ValueError("Слишком большое разрешение изображения")
            image = ImageOps.exif_transpose(source)
            if image.mode != "RGB":
                image = image.convert("RGB")
            image.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
            width, height = image.size
            image.save(normalized, "JPEG", quality=90, optimize=True)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        normalized.unlink(missing_ok=True)
        raise ValueError(
            "Изображение повреждено или имеет неподдерживаемый формат"
        ) from exc
    return {"path": normalized, "width": width, "height": height}


@router.get("")
async def list_admin_tarot_spreads(
    _user: dict[str, Any] = Depends(get_current_admin),
):
    docs = (
        await get_db()
        .tarot_spreads.find({"deleted": {"$ne": True}})
        .sort([("sort", 1), ("titleRu", 1)])
        .to_list(length=200)
    )
    return {"items": [_admin_item(doc) for doc in docs]}


@router.post("", status_code=201)
async def create_tarot_spread(
    body: TarotSpreadDraftIn,
    user: dict[str, Any] = Depends(get_current_admin),
):
    now = _utcnow()
    doc = {
        **body.model_dump(),
        "drawCount": len(body.positions),
        "published": False,
        "deleted": False,
        "cover": None,
        "coverVersions": [],
        "contentVersion": uuid4().hex,
        "createdAt": now,
        "updatedAt": now,
        "createdBy": user["_id"],
        "updatedBy": user["_id"],
    }
    try:
        result = await get_db().tarot_spreads.insert_one(doc)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="Такой slug уже существует") from exc
    doc["_id"] = result.inserted_id
    return _admin_item(doc)


@router.put("/{slug}")
async def update_tarot_spread(
    slug: str,
    body: TarotSpreadDraftIn,
    user: dict[str, Any] = Depends(get_current_admin),
):
    doc = await _document(slug)
    if doc.get("published") and body.slug != slug:
        raise HTTPException(
            status_code=409,
            detail="Сначала снимите расклад с публикации, чтобы изменить slug",
        )
    try:
        await get_db().tarot_spreads.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    **body.model_dump(),
                    "drawCount": len(body.positions),
                    "contentVersion": uuid4().hex,
                    "updatedAt": _utcnow(),
                    "updatedBy": user["_id"],
                }
            },
        )
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="Такой slug уже существует") from exc
    return _admin_item(await _document(body.slug))


@router.post("/reorder")
async def reorder_tarot_spreads(
    body: ReorderIn,
    user: dict[str, Any] = Depends(get_current_admin),
):
    now = _utcnow()
    for position, slug in enumerate(body.slugs):
        await get_db().tarot_spreads.update_one(
            {"slug": slug, "deleted": {"$ne": True}},
            {
                "$set": {
                    "sort": position,
                    "contentVersion": uuid4().hex,
                    "updatedAt": now,
                    "updatedBy": user["_id"],
                }
            },
        )
    return {"ok": True}


@router.delete("/{slug}")
async def archive_tarot_spread(
    slug: str,
    user: dict[str, Any] = Depends(get_current_admin),
):
    doc = await _document(slug)
    await get_db().tarot_spreads.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "published": False,
                "deleted": True,
                "contentVersion": uuid4().hex,
                "updatedAt": _utcnow(),
                "updatedBy": user["_id"],
            }
        },
    )
    return {"ok": True}


@router.post("/{slug}/cover")
async def upload_tarot_spread_cover(
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
            cover = await run_in_threadpool(_normalize_spread_cover, path)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        normalized = cover.pop("path")
        key = versioned_tarot_spread_cover_key(slug)
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
        update: dict[str, Any] = {
            "$set": {
                "cover": uploaded,
                "contentVersion": uuid4().hex,
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
        await get_db().tarot_spreads.update_one({"_id": doc["_id"]}, update)
        return _admin_item(await _document(slug))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to upload tarot spread cover | slug=%s", slug)
        raise HTTPException(
            status_code=502,
            detail="Не удалось загрузить изображение расклада в S3",
        ) from exc
    finally:
        path.unlink(missing_ok=True)
        if normalized:
            normalized.unlink(missing_ok=True)


@router.post("/{slug}/cover/rollback")
async def rollback_tarot_spread_cover(
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
        raise HTTPException(status_code=404, detail="Версия изображения не найдена")
    remaining = [
        item for item in versions if str(item.get("version")) != body.version
    ]
    current = doc.get("cover")
    if isinstance(current, dict):
        remaining.insert(0, current)
    await get_db().tarot_spreads.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "cover": selected,
                "coverVersions": remaining[:20],
                "contentVersion": uuid4().hex,
                "updatedAt": _utcnow(),
                "updatedBy": user["_id"],
            }
        },
    )
    return _admin_item(await _document(slug))


@router.post("/{slug}/publish")
async def publish_tarot_spread(
    slug: str,
    user: dict[str, Any] = Depends(get_current_admin),
):
    doc = await _document(slug)
    positions = doc.get("positions") or []
    if not doc.get("titleRu") or not doc.get("subtitleRu") or not doc.get("cover"):
        raise HTTPException(
            status_code=409,
            detail="Нельзя опубликовать: заполните тексты и загрузите изображение",
        )
    if not 1 <= len(positions) <= 5:
        raise HTTPException(
            status_code=409,
            detail="Нельзя опубликовать: требуется от 1 до 5 позиций",
        )
    now = _utcnow()
    await get_db().tarot_spreads.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "published": True,
                "publishedAt": now,
                "contentVersion": uuid4().hex,
                "updatedAt": now,
                "updatedBy": user["_id"],
            }
        },
    )
    return _admin_item(await _document(slug))


@router.post("/{slug}/unpublish")
async def unpublish_tarot_spread(
    slug: str,
    user: dict[str, Any] = Depends(get_current_admin),
):
    doc = await _document(slug)
    await get_db().tarot_spreads.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "published": False,
                "contentVersion": uuid4().hex,
                "updatedAt": _utcnow(),
                "updatedBy": user["_id"],
            }
        },
    )
    return _admin_item(await _document(slug))
