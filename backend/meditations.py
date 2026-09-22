import hashlib
import json
import logging
import os
import re
import shutil
from io import BytesIO
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.parse import quote
from urllib.request import urlopen

from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
from mutagen import File as MutagenFile
from pydantic import BaseModel, Field

from db import get_db, mongo_configured

logger = logging.getLogger(__name__)

router = APIRouter()

ROOT = Path(__file__).parent
CATALOG_CACHE_CONTROL = "no-store"
CATALOG_PATH = ROOT / "data" / "meditations.json"
AUDIO_DIR = ROOT / "media" / "meditations"
COVER_DIR = ROOT / "media" / "covers"
COVER_CACHE_DIR = COVER_DIR / "_cache"
COVER_MAX_SIZE = (720, 900)
COVER_JPEG_QUALITY = 78
COVER_CACHE_TAG = "w720q78"

SAFE_FILE = re.compile(r"^[A-Za-z0-9._-]+$")
AUDIO_SUFFIXES = {".mp3", ".m4a", ".wav", ".aac"}
COVER_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}

_json_catalog_mtime: Optional[float] = None
_json_catalog_rows: list[dict[str, Any]] = []
_cover_jpeg_cache: dict[str, bytes] = {}
_audio_duration_memo: dict[str, tuple[int, int, int]] = {}


class MeditationOut(BaseModel):
    slug: str
    title: str
    description: str
    tags: list[str] = Field(default_factory=list)
    durationSec: int = 0
    audioFile: Optional[str] = None
    coverFile: Optional[str] = None
    audioUrl: Optional[str] = None
    coverUrl: Optional[str] = None
    hasAudio: bool = False
    hasCover: bool = False
    version: str = ""
    audioRev: str = ""
    coverRev: str = ""
    sort: int = 0


class MeditationListOut(BaseModel):
    items: list[MeditationOut]
    tags: list[str]


def media_root() -> Path:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    COVER_DIR.mkdir(parents=True, exist_ok=True)
    return ROOT / "media"


def _safe_name(name: Optional[str]) -> Optional[str]:
    if not name or not SAFE_FILE.match(name):
        return None
    return name


def _safe_object_key(value: Optional[str]) -> Optional[str]:
    key = str(value or "").strip().strip("/")
    if not key or ".." in key:
        return None
    parts = key.split("/")
    if not all(part and SAFE_FILE.fullmatch(part) for part in parts):
        return None
    return key


def _media_cache_name(key: str) -> str:
    safe_key = _safe_object_key(key)
    if not safe_key:
        raise FileNotFoundError("invalid media key")
    if "/" not in safe_key:
        return safe_key
    suffix = Path(safe_key).suffix.lower()
    digest = hashlib.sha256(safe_key.encode("utf-8")).hexdigest()[:24]
    return f"{digest}{suffix}"


def audio_cache_path(key: str) -> Path:
    return AUDIO_DIR / _media_cache_name(key)


def _cover_source_path(key: str) -> Path:
    return COVER_DIR / _media_cache_name(key)


def _s3_public_base() -> str:
    return (os.getenv("S3_PUBLIC_BASE_URL") or "").strip().rstrip("/")


def _env_prefix(key: str, default: str) -> str:
    if key not in os.environ:
        return default
    return os.environ[key].strip().strip("/")


def _s3_prefix(kind: str) -> str:
    if kind == "cover":
        return _env_prefix("S3_COVERS_PREFIX", "")
    return _env_prefix("S3_MEDITATIONS_PREFIX", "")


def _public_api() -> str:
    return (os.getenv("PUBLIC_API_URL") or "").rstrip("/")


def _asset_proxy_url(slug: str, kind: str) -> Optional[str]:
    public = _public_api()
    if not public or not slug:
        return None
    return f"{public}/api/meditations/{quote(slug)}/{kind}"


def _cover_cache_path(key: str) -> Path:
    stem = Path(_media_cache_name(key)).stem
    return COVER_CACHE_DIR / f"{stem}.{COVER_CACHE_TAG}.jpg"


def _encode_cover_jpeg(key: str) -> bytes:
    cached = _cover_jpeg_cache.get(key)
    if cached:
        return cached
    path = _cover_cache_path(key)
    if path.is_file() and path.stat().st_size > 1000:
        data = path.read_bytes()
        _cover_jpeg_cache[key] = data
        return data
    remote = _remote_url("cover", key)
    local = _cover_source_path(key)
    raw: bytes
    if local.is_file():
        raw = local.read_bytes()
    elif remote:
        with urlopen(remote, timeout=20) as response:
            raw = response.read()
    else:
        raise FileNotFoundError(key)
    from PIL import Image as PILImage

    image = PILImage.open(BytesIO(raw))
    if image.mode != "RGB":
        image = image.convert("RGB")
    image.thumbnail(COVER_MAX_SIZE, PILImage.Resampling.LANCZOS)
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=COVER_JPEG_QUALITY, optimize=True)
    data = buffer.getvalue()
    COVER_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    _cover_jpeg_cache[key] = data
    return data


def warmup_covers() -> None:
    for row in _read_catalog():
        name = row.get("coverFile")
        if not name:
            continue
        try:
            _encode_cover_jpeg(str(name))
        except Exception:
            logger.exception("Failed to warm meditation cover %s", name)


def _audio_rev_path(dest: Path) -> Path:
    return dest.with_name(dest.name + ".rev")


def _local_audio_rev(key: str) -> str:
    try:
        dest = audio_cache_path(key)
    except FileNotFoundError:
        return ""
    rev_file = _audio_rev_path(dest)
    if rev_file.is_file():
        return rev_file.read_text(encoding="utf-8").strip()
    if dest.is_file():
        stat = dest.stat()
        return f"{stat.st_size}-{int(stat.st_mtime)}"
    return ""


def _local_audio_duration(key: Optional[str]) -> int:
    try:
        path = audio_cache_path(str(key or ""))
    except FileNotFoundError:
        return 0
    if not path.is_file():
        return 0
    stat = path.stat()
    cache_key = str(path)
    cached = _audio_duration_memo.get(cache_key)
    mtime_ns = stat.st_mtime_ns
    if cached and cached[0] == stat.st_size and cached[1] == mtime_ns:
        return cached[2]
    try:
        media = MutagenFile(path)
        length = float(media.info.length) if media and media.info else 0.0
        duration = max(0, int(round(length)))
    except Exception:
        logger.exception("Failed to read audio duration: %s", key)
        duration = 0
    _audio_duration_memo[cache_key] = (stat.st_size, mtime_ns, duration)
    return duration


def cache_uploaded_audio(source: Path, key: str, revision: str) -> Path:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    dest = audio_cache_path(key)
    shutil.copyfile(source, dest)
    _audio_rev_path(dest).write_text(revision, encoding="utf-8")
    _audio_duration_memo.pop(str(dest), None)
    return dest


def cache_uploaded_cover(source: Path, key: str) -> Path:
    COVER_DIR.mkdir(parents=True, exist_ok=True)
    dest = _cover_source_path(key)
    shutil.copyfile(source, dest)
    _cover_jpeg_cache.pop(key, None)
    cached = _cover_cache_path(key)
    cached.unlink(missing_ok=True)
    try:
        _encode_cover_jpeg(key)
    except Exception:
        logger.exception("Failed to encode uploaded cover %s", key)
    return dest


def _ensure_audio_cached(key: str, expected_revision: str = "") -> Path:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    dest = audio_cache_path(key)
    rev_file = _audio_rev_path(dest)
    local_rev = rev_file.read_text(encoding="utf-8").strip() if rev_file.is_file() else ""
    if dest.is_file() and dest.stat().st_size > 1000:
        if not expected_revision or expected_revision == local_rev:
            return dest
    remote = _remote_url("audio", key)
    if remote:
        temp = dest.with_name(dest.name + ".download")
        try:
            with urlopen(remote, timeout=20) as response:
                temp.write_bytes(response.read())
            temp.replace(dest)
        except Exception:
            temp.unlink(missing_ok=True)
            if dest.is_file() and dest.stat().st_size > 1000:
                return dest
            raise
        if expected_revision:
            rev_file.write_text(expected_revision, encoding="utf-8")
        return dest
    if dest.is_file():
        return dest
    raise FileNotFoundError(key)


def _remote_url(kind: str, name: Optional[str]) -> Optional[str]:
    base = _s3_public_base()
    key = _safe_object_key(name)
    if not base or not key:
        return None
    if "/" in key:
        parts = key.split("/")
    else:
        prefix = _s3_prefix(kind)
        parts = [part for part in prefix.split("/") if part] + [key]
    return f"{base}/{'/'.join(quote(part) for part in parts)}"


def _has_file(directory: Path, name: Optional[str], suffixes: set[str]) -> bool:
    safe = _safe_name(name)
    if not safe:
        return False
    path = directory / safe
    return path.is_file() and path.suffix.lower() in suffixes


def _asset_url(kind: str, name: Optional[str], suffixes: set[str], local_dir: Path) -> tuple[Optional[str], bool]:
    remote = _remote_url(kind, name)
    if remote:
        return remote, True
    if _has_file(local_dir, name, suffixes):
        public = (os.getenv("PUBLIC_API_URL") or "").rstrip("/")
        folder = "covers" if kind == "cover" else "meditations"
        if public and name:
            return f"{public}/media/{folder}/{quote(name)}", True
        return None, True
    return None, False


def _read_catalog() -> list[dict[str, Any]]:
    global _json_catalog_mtime, _json_catalog_rows
    try:
        mtime = CATALOG_PATH.stat().st_mtime
    except OSError:
        logger.warning("Meditation catalog missing: %s", CATALOG_PATH)
        return []
    if _json_catalog_rows and _json_catalog_mtime == mtime:
        return _json_catalog_rows
    raw = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("meditations.json must be a JSON array")
    rows: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        slug = str(item.get("slug") or "").strip()
        title = str(item.get("title") or "").strip()
        if not slug or not title:
            continue
        tags = [
            str(tag).strip()
            for tag in (item.get("tags") or [])
            if str(tag).strip()
        ]
        rows.append(
            {
                "slug": slug,
                "title": title,
                "description": str(item.get("description") or "").strip(),
                "tags": tags,
                "durationSec": int(item.get("durationSec") or 0),
                "audioFile": _safe_name(item.get("audioFile")),
                "coverFile": _safe_name(item.get("coverFile")),
                "sort": int(item.get("sort") or 0),
            }
        )
    rows.sort(key=lambda row: (row["sort"], row["title"]))
    _json_catalog_mtime = mtime
    _json_catalog_rows = rows
    return rows


def _as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _row_from_document(doc: dict[str, Any]) -> dict[str, Any]:
    audio = doc.get("audio") if isinstance(doc.get("audio"), dict) else {}
    cover = doc.get("cover") if isinstance(doc.get("cover"), dict) else {}
    audio_key = audio.get("key") or doc.get("audioKey") or doc.get("audioFile")
    cover_key = cover.get("key") or doc.get("coverKey") or doc.get("coverFile")
    tags_raw = doc.get("tags") or []
    if not isinstance(tags_raw, list):
        tags_raw = [tags_raw]
    return {
        "slug": str(doc.get("slug") or ""),
        "title": str(doc.get("title") or ""),
        "description": str(doc.get("description") or ""),
        "tags": [str(tag).strip() for tag in tags_raw if str(tag).strip()],
        "durationSec": _as_int(audio.get("durationSec") or doc.get("durationSec")),
        "audioFile": _safe_object_key(audio_key),
        "coverFile": _safe_object_key(cover_key),
        "audioRev": str(
            audio.get("version") or audio.get("etag") or doc.get("audioRev") or ""
        ),
        "coverRev": str(
            cover.get("version") or cover.get("etag") or doc.get("coverRev") or ""
        ),
        "sort": _as_int(doc.get("sort")),
        "published": bool(doc.get("published", True)),
    }


async def _database_rows(*, include_unpublished: bool = False) -> Optional[list[dict[str, Any]]]:
    if not mongo_configured():
        return None
    query: dict[str, Any] = {"deleted": {"$ne": True}}
    if not include_unpublished:
        query["published"] = True
    try:
        docs = (
            await get_db()
            .meditations.find(query)
            .sort([("sort", 1), ("title", 1)])
            .to_list(length=500)
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to read meditation catalog from MongoDB")
        return None
    rows: list[dict[str, Any]] = []
    for doc in docs:
        try:
            row = _row_from_document(doc)
        except Exception:
            logger.exception(
                "Skipping bad meditation document | slug=%s",
                doc.get("slug"),
            )
            continue
        if row.get("slug") and row.get("title"):
            rows.append(row)
    return rows


async def _catalog_rows(*, include_unpublished: bool = False) -> list[dict[str, Any]]:
    if mongo_configured():
        rows = await _database_rows(include_unpublished=include_unpublished)
        if rows is None:
            raise HTTPException(status_code=503, detail="Каталог временно недоступен")
        return rows
    return _read_catalog()


async def _row_by_slug(slug: str) -> dict[str, Any]:
    for row in await _catalog_rows():
        if row["slug"] == slug:
            return row
    raise HTTPException(status_code=404, detail="Медитация не найдена")


def _to_out(row: dict[str, Any]) -> MeditationOut:
    audio_file = row.get("audioFile")
    cover_file = row.get("coverFile")
    slug = row["slug"]
    audio_rev = str(row.get("audioRev") or "")
    if audio_file and not audio_rev:
        audio_rev = _local_audio_rev(str(audio_file))
    cover_rev = str(row.get("coverRev") or "")
    remote_audio = _remote_url("audio", audio_file) if audio_file else None
    audio_url = remote_audio or (
        _asset_proxy_url(slug, "audio") if audio_file else None
    )
    cover_url = _asset_proxy_url(slug, "cover") if cover_file else None
    # Versioned S3 keys are already unique; extra query params are only
    # needed on the API proxy, which may otherwise be cached by iOS.
    if audio_url and audio_rev and not remote_audio:
        audio_url = f"{audio_url}?v={quote(audio_rev)}"
    if cover_url and cover_rev:
        cover_url = f"{cover_url}?v={quote(cover_rev)}"
    stored_duration = _as_int(row.get("durationSec"))
    duration = stored_duration or _local_audio_duration(audio_file)
    return MeditationOut(
        slug=slug,
        title=row["title"],
        description=row.get("description") or "",
        tags=list(row.get("tags") or []),
        durationSec=duration,
        audioFile=audio_file,
        coverFile=cover_file,
        audioUrl=audio_url,
        coverUrl=cover_url,
        hasAudio=bool(audio_file),
        hasCover=bool(cover_file),
        version=audio_rev,
        audioRev=audio_rev,
        coverRev=cover_rev,
        sort=_as_int(row.get("sort")),
    )


async def seed_meditations() -> None:
    if mongo_configured():
        try:
            rows = _read_catalog()
            if rows:
                db = get_db()
                await db.meditations.create_index("slug", unique=True)
                await db.meditations.create_index("tags")
                for row in rows:
                    existing = await db.meditations.find_one({"slug": row["slug"]})
                    if existing:
                        updates: dict[str, Any] = {}
                        if "published" not in existing:
                            updates["published"] = True
                        if "deleted" not in existing:
                            updates["deleted"] = False
                        if "audio" not in existing and row.get("audioFile"):
                            duration = (
                                _local_audio_duration(row["audioFile"])
                                or int(row.get("durationSec") or 0)
                            )
                            updates["audio"] = {
                                "key": row["audioFile"],
                                "version": _local_audio_rev(row["audioFile"]),
                                "durationSec": duration,
                                "size": (
                                    audio_cache_path(row["audioFile"]).stat().st_size
                                    if audio_cache_path(row["audioFile"]).is_file()
                                    else 0
                                ),
                                "contentType": "audio/mpeg",
                                "createdAt": datetime.now(timezone.utc),
                            }
                            updates["durationSec"] = duration
                        elif (
                            isinstance(existing.get("audio"), dict)
                            and existing["audio"].get("key") == row.get("audioFile")
                            and not existing["audio"].get("version")
                        ):
                            duration = _local_audio_duration(row.get("audioFile"))
                            revision = _local_audio_rev(str(row.get("audioFile") or ""))
                            if duration:
                                updates["audio.durationSec"] = duration
                                updates["durationSec"] = duration
                            if revision:
                                updates["audio.version"] = revision
                        if "cover" not in existing and row.get("coverFile"):
                            updates["cover"] = {
                                "key": row["coverFile"],
                                "version": "",
                                "contentType": "image/jpeg",
                                "createdAt": datetime.now(timezone.utc),
                            }
                        if updates:
                            await db.meditations.update_one(
                                {"_id": existing["_id"]},
                                {"$set": updates},
                            )
                        continue

                    duration = (
                        _local_audio_duration(row.get("audioFile"))
                        or int(row.get("durationSec") or 0)
                    )
                    await db.meditations.insert_one(
                        {
                            **row,
                            "durationSec": duration,
                            "published": True,
                            "deleted": False,
                            "audio": (
                                {
                                    "key": row["audioFile"],
                                    "version": _local_audio_rev(row["audioFile"]),
                                    "durationSec": duration,
                                    "contentType": "audio/mpeg",
                                    "createdAt": datetime.now(timezone.utc),
                                }
                                if row.get("audioFile")
                                else None
                            ),
                            "cover": (
                                {
                                    "key": row["coverFile"],
                                    "version": "",
                                    "contentType": "image/jpeg",
                                    "createdAt": datetime.now(timezone.utc),
                                }
                                if row.get("coverFile")
                                else None
                            ),
                            "audioVersions": [],
                            "coverVersions": [],
                            "createdAt": datetime.now(timezone.utc),
                            "updatedAt": datetime.now(timezone.utc),
                        }
                    )
                logger.info("Meditation catalog synced | count=%s", len(rows))
        except Exception:
            logger.exception("Failed to sync meditation catalog to MongoDB")


def _matches(row: dict[str, Any], q: str, tag: str) -> bool:
    tags = [str(item).lower() for item in (row.get("tags") or [])]
    if tag and tag not in tags:
        return False
    if not q:
        return True
    hay = " ".join(
        [
            str(row.get("title") or ""),
            str(row.get("description") or ""),
            " ".join(row.get("tags") or []),
        ]
    ).lower()
    return q in hay


@router.get("/meditations", response_model=MeditationListOut)
async def list_meditations(
    response: Response,
    q: str = Query("", max_length=80),
    tag: str = Query("", max_length=40),
):
    response.headers["Cache-Control"] = CATALOG_CACHE_CONTROL
    query = q.strip().lower()
    tag_n = tag.strip().lower()
    rows = await _catalog_rows()
    items: list[MeditationOut] = []
    for row in rows:
        if not _matches(row, query, tag_n):
            continue
        try:
            items.append(_to_out(row))
        except Exception:
            logger.exception("Skipping meditation in public catalog | slug=%s", row.get("slug"))
    tags: list[str] = []
    seen: set[str] = set()
    for row in rows:
        for name in row.get("tags") or []:
            key = str(name).lower()
            if key in seen:
                continue
            seen.add(key)
            tags.append(str(name))
    tags.sort(key=lambda name: name.lower())
    return MeditationListOut(items=items, tags=tags)


def _cover_file_response(row: dict[str, Any], filename: str) -> FileResponse:
    return FileResponse(
        _cover_cache_path(filename),
        media_type="image/jpeg",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": (
                "public, max-age=31536000, immutable"
                if row.get("coverRev")
                else "public, max-age=0, must-revalidate"
            ),
        },
    )


def _audio_headers(row: dict[str, Any], dest: Path) -> dict[str, str]:
    name = Path(str(row.get("audioFile") or dest.name)).name
    if not name.lower().endswith(".mp3"):
        name = f"{dest.stem}.mp3"
    return {
        "Accept-Ranges": "bytes",
        "Content-Disposition": f'inline; filename="{name}"',
        "Cache-Control": (
            "public, max-age=31536000, immutable"
            if row.get("audioRev")
            else "public, max-age=0, must-revalidate"
        ),
    }


def _parse_byte_range(range_header: str, file_size: int) -> tuple[int, int] | None:
    if not range_header.lower().startswith("bytes="):
        return None
    spec = range_header.split("=", 1)[1].split(",", 1)[0].strip()
    left, _, right = spec.partition("-")
    try:
        if left and right:
            start, end = int(left), int(right)
        elif left:
            start, end = int(left), file_size - 1
        elif right:
            suffix = int(right)
            if suffix <= 0:
                return None
            start, end = max(0, file_size - suffix), file_size - 1
        else:
            return None
    except ValueError:
        return None
    start = max(0, start)
    end = min(file_size - 1, end)
    if start > end:
        return None
    return start, end


def _ranged_audio_response(
    dest: Path,
    request: Request,
    row: dict[str, Any],
) -> Response:
    file_size = dest.stat().st_size
    headers = _audio_headers(row, dest)
    byte_range = _parse_byte_range(request.headers.get("range") or "", file_size)
    if byte_range:
        start, end = byte_range
        status = 206
        headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"
        length = end - start + 1
    else:
        start, end = 0, file_size - 1
        status = 200
        length = file_size
    headers["Content-Length"] = str(length)
    if request.method == "HEAD":
        return Response(status_code=status, media_type="audio/mpeg", headers=headers)

    def iterfile():
        with dest.open("rb") as handle:
            handle.seek(start)
            remaining = length
            chunk_size = 64 * 1024
            while remaining > 0:
                chunk = handle.read(min(chunk_size, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    return StreamingResponse(
        iterfile(),
        status_code=status,
        media_type="audio/mpeg",
        headers=headers,
    )


@router.api_route("/meditations/{slug}/cover", methods=["GET", "HEAD"])
async def serve_meditation_cover(slug: str):
    row = await _row_by_slug(slug)
    filename = row.get("coverFile")
    if not filename:
        raise HTTPException(status_code=404, detail="Обложка не найдена")
    try:
        await run_in_threadpool(_encode_cover_jpeg, filename)
    except Exception:
        logger.exception("Failed to load meditation cover %s", slug)
        raise HTTPException(status_code=404, detail="Обложка не найдена") from None
    return _cover_file_response(row, filename)


@router.api_route("/meditations/{slug}/audio", methods=["GET", "HEAD"])
async def serve_meditation_audio(slug: str, request: Request):
    row = await _row_by_slug(slug)
    filename = row.get("audioFile")
    if not filename:
        raise HTTPException(status_code=404, detail="Аудио не найдено")
    remote = _remote_url("audio", filename)
    if remote:
        return RedirectResponse(url=remote, status_code=302)
    try:
        dest = audio_cache_path(str(filename))
    except FileNotFoundError:
        dest = None
    if dest is not None and dest.is_file() and dest.stat().st_size > 1000:
        return _ranged_audio_response(dest, request, row)
    raise HTTPException(status_code=404, detail="Аудио не найдено")


@router.api_route("/meditations/cover/{filename}", methods=["GET", "HEAD"])
async def serve_meditation_cover_by_file(filename: str):
    safe = _safe_name(filename)
    if not safe:
        raise HTTPException(status_code=404, detail="Обложка не найдена")
    rows = await _catalog_rows()
    for row in rows:
        if row.get("coverFile") == safe:
            return await serve_meditation_cover(row["slug"])
    raise HTTPException(status_code=404, detail="Обложка не найдена")


@router.get("/meditations/{slug}", response_model=MeditationOut)
async def get_meditation(slug: str, response: Response):
    response.headers["Cache-Control"] = CATALOG_CACHE_CONTROL
    return _to_out(await _row_by_slug(slug))
