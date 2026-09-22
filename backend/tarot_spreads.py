from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from db import get_db, mongo_configured
from storage import public_object_url


logger = logging.getLogger(__name__)
router = APIRouter(tags=["tarot-spreads"])
ROOT = Path(__file__).parent
SEED_PATH = ROOT / "data" / "tarot_spreads.json"
CATALOG_CACHE_CONTROL = "no-store"


class TarotSpreadPositionOut(BaseModel):
    id: str
    labelRu: str


class TarotSpreadOut(BaseModel):
    id: str
    titleRu: str
    subtitleRu: str
    drawCount: int = Field(ge=1, le=5)
    positions: list[TarotSpreadPositionOut]
    coverUrl: Optional[str] = None
    coverRev: str = ""
    version: str = ""
    sort: int = 0


class TarotSpreadListOut(BaseModel):
    items: list[TarotSpreadOut]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def seed_cover_key(slug: str, asset: str) -> str:
    safe_asset = Path(asset).name
    return f"tarot-spreads/{slug}/covers/seed-{safe_asset}"


def read_tarot_spread_seed() -> list[dict[str, Any]]:
    raw = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("tarot_spreads.json must be a JSON array")
    rows: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        slug = str(item.get("slug") or "").strip()
        positions = [
            {
                "id": str(position.get("id") or "").strip(),
                "labelRu": str(position.get("labelRu") or "").strip(),
            }
            for position in (item.get("positions") or [])
            if isinstance(position, dict)
        ]
        if not slug or not 1 <= len(positions) <= 5:
            continue
        cover_asset = Path(str(item.get("coverAsset") or "")).name
        cover_key = seed_cover_key(slug, cover_asset) if cover_asset else ""
        rows.append(
            {
                "slug": slug,
                "titleRu": str(item.get("titleRu") or "").strip(),
                "subtitleRu": str(item.get("subtitleRu") or "").strip(),
                "positions": positions,
                "drawCount": len(positions),
                "sort": int(item.get("sort") or 0),
                "coverAsset": cover_asset,
                "cover": (
                    {
                        "key": cover_key,
                        "url": public_object_url(cover_key),
                        "version": "seed-v1",
                        "contentType": "image/jpeg",
                        "createdAt": _utcnow(),
                    }
                    if cover_key
                    else None
                ),
            }
        )
    rows.sort(key=lambda row: (row["sort"], row["titleRu"]))
    return rows


def _to_out(doc: dict[str, Any]) -> TarotSpreadOut:
    cover = doc.get("cover") if isinstance(doc.get("cover"), dict) else {}
    cover_rev = str(cover.get("version") or cover.get("etag") or "")
    cover_url = str(cover.get("url") or "")
    if not cover_url and cover.get("key"):
        cover_url = public_object_url(str(cover["key"]))
    if cover_url and cover_rev and "v=" not in cover_url:
        separator = "&" if "?" in cover_url else "?"
        cover_url = f"{cover_url}{separator}v={quote(cover_rev)}"
    positions = [
        TarotSpreadPositionOut(
            id=str(position.get("id") or ""),
            labelRu=str(position.get("labelRu") or ""),
        )
        for position in (doc.get("positions") or [])
        if isinstance(position, dict)
    ]
    return TarotSpreadOut(
        id=str(doc.get("slug") or ""),
        titleRu=str(doc.get("titleRu") or ""),
        subtitleRu=str(doc.get("subtitleRu") or ""),
        drawCount=len(positions),
        positions=positions,
        coverUrl=cover_url or None,
        coverRev=cover_rev,
        version=str(doc.get("contentVersion") or cover_rev),
        sort=int(doc.get("sort") or 0),
    )


async def _published_documents() -> Optional[list[dict[str, Any]]]:
    if not mongo_configured():
        return None
    try:
        return (
            await get_db()
            .tarot_spreads.find(
                {"published": True, "deleted": {"$ne": True}}
            )
            .sort([("sort", 1), ("titleRu", 1)])
            .to_list(length=200)
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to read tarot spreads from MongoDB")
        return None


async def _catalog_documents() -> list[dict[str, Any]]:
    if mongo_configured():
        docs = await _published_documents()
        if docs is None:
            raise HTTPException(status_code=503, detail="Каталог временно недоступен")
        return docs
    return [
        {**row, "published": True, "contentVersion": "seed-v1"}
        for row in read_tarot_spread_seed()
    ]


async def seed_tarot_spreads() -> None:
    if not mongo_configured():
        return
    db = get_db()
    rows = read_tarot_spread_seed()
    for row in rows:
        now = _utcnow()
        insert_doc = {
            **row,
            "published": True,
            "deleted": False,
            "coverVersions": [],
            "contentVersion": "seed-v1",
            "createdAt": now,
            "updatedAt": now,
        }
        try:
            await db.tarot_spreads.update_one(
                {"slug": row["slug"]},
                {"$setOnInsert": insert_doc},
                upsert=True,
            )
            existing = await db.tarot_spreads.find_one({"slug": row["slug"]})
            if existing:
                missing = {
                    key: value
                    for key, value in insert_doc.items()
                    if key not in existing
                }
                if missing:
                    await db.tarot_spreads.update_one(
                        {"_id": existing["_id"]},
                        {"$set": missing},
                    )
        except DuplicateKeyError:
            # Multiple uvicorn workers may seed simultaneously.
            continue
    logger.info("Tarot spreads seeded | count=%s", len(rows))


@router.get("/tarot-spreads", response_model=TarotSpreadListOut)
async def list_tarot_spreads(response: Response):
    response.headers["Cache-Control"] = CATALOG_CACHE_CONTROL
    docs = await _catalog_documents()
    return TarotSpreadListOut(items=[_to_out(doc) for doc in docs])


@router.get("/tarot-spreads/{slug}", response_model=TarotSpreadOut)
async def get_tarot_spread(slug: str, response: Response):
    response.headers["Cache-Control"] = CATALOG_CACHE_CONTROL
    docs = await _catalog_documents()
    normalized = "three-situation" if slug == "three-card" else slug
    for doc in docs:
        if doc.get("slug") == normalized:
            return _to_out(doc)
    raise HTTPException(status_code=404, detail="Расклад не найден")
