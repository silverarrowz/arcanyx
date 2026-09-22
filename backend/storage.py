from __future__ import annotations

import mimetypes
import os
import re
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse

import boto3
from botocore.client import Config


SAFE_SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def s3_endpoint_url() -> str:
    return _env("S3_ENDPOINT_URL", "https://s3.twcstorage.ru").rstrip("/")


def s3_bucket() -> str:
    explicit = _env("S3_BUCKET")
    if explicit:
        return explicit
    public_base = _env("S3_PUBLIC_BASE_URL")
    if public_base:
        parts = [part for part in urlparse(public_base).path.split("/") if part]
        if parts:
            return parts[0]
    return ""


def s3_public_base() -> str:
    explicit = _env("S3_PUBLIC_BASE_URL").rstrip("/")
    if explicit:
        return explicit
    bucket = s3_bucket()
    return f"{s3_endpoint_url()}/{quote(bucket)}" if bucket else ""


def s3_configured() -> bool:
    return bool(
        s3_bucket()
        and _env("S3_ACCESS_KEY_ID")
        and _env("S3_SECRET_ACCESS_KEY")
    )


def storage_status() -> dict[str, Any]:
    return {
        "configured": s3_configured(),
        "endpoint": s3_endpoint_url(),
        "bucket": s3_bucket(),
        "public_base": s3_public_base(),
    }


def _client():
    if not s3_configured():
        raise RuntimeError(
            "Timeweb S3 не настроен: добавьте S3_ACCESS_KEY_ID и "
            "S3_SECRET_ACCESS_KEY в backend/.env"
        )
    return boto3.client(
        "s3",
        endpoint_url=s3_endpoint_url(),
        region_name=_env("S3_REGION", "ru-1"),
        aws_access_key_id=_env("S3_ACCESS_KEY_ID"),
        aws_secret_access_key=_env("S3_SECRET_ACCESS_KEY"),
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def versioned_content_key(
    namespace: str,
    slug: str,
    kind: str,
    extension: str,
) -> str:
    allowed = {
        "meditations": {"audio", "covers"},
        "tarot-spreads": {"covers"},
    }
    if namespace not in allowed or kind not in allowed[namespace]:
        raise ValueError("Unsupported storage kind")
    slug_n = slug.strip().lower()
    if not SAFE_SLUG.fullmatch(slug_n):
        raise ValueError("Некорректный slug")
    ext = extension.lower()
    if not ext.startswith("."):
        ext = f".{ext}"
    return f"{namespace}/{slug_n}/{kind}/{uuid.uuid4().hex}{ext}"


def versioned_object_key(kind: str, slug: str, extension: str) -> str:
    return versioned_content_key("meditations", slug, kind, extension)


def versioned_tarot_spread_cover_key(slug: str, extension: str = ".jpg") -> str:
    return versioned_content_key("tarot-spreads", slug, "covers", extension)


def public_object_url(key: str) -> str:
    base = s3_public_base()
    if not base:
        return ""
    encoded = "/".join(quote(part) for part in key.split("/") if part)
    return f"{base}/{encoded}"


def upload_bytes(
    data: bytes,
    key: str,
    *,
    content_type: str | None = None,
) -> dict[str, Any]:
    media_type = content_type or "application/octet-stream"
    client = _client()
    client.put_object(
        Bucket=s3_bucket(),
        Key=key,
        Body=data,
        ContentType=media_type,
        CacheControl="public, max-age=31536000, immutable",
    )
    return {
        "key": key,
        "url": public_object_url(key),
        "etag": "",
        "size": len(data),
        "contentType": media_type,
    }


def upload_path(
    path: Path,
    key: str,
    *,
    content_type: str | None = None,
) -> dict[str, Any]:
    media_type = (
        content_type
        or mimetypes.guess_type(path.name)[0]
        or "application/octet-stream"
    )
    client = _client()
    client.upload_file(
        str(path),
        s3_bucket(),
        key,
        ExtraArgs={
            "ContentType": media_type,
            "CacheControl": "public, max-age=31536000, immutable",
        },
    )
    head = client.head_object(Bucket=s3_bucket(), Key=key)
    etag = str(head.get("ETag") or "").strip().strip('"')
    return {
        "key": key,
        "url": public_object_url(key),
        "etag": etag,
        "size": int(head.get("ContentLength") or path.stat().st_size),
        "contentType": str(head.get("ContentType") or media_type),
    }


def delete_object(key: str) -> None:
    _client().delete_object(Bucket=s3_bucket(), Key=key)
