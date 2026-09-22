import asyncio
import logging
import os
from typing import Any, Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


def mongo_configured() -> bool:
    return bool((os.getenv("MONGODB_URI") or os.getenv("MONGO_URL") or "").strip())


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=503, detail="База данных недоступна")
    return _db


async def connect_db() -> None:
    global _client, _db
    uri = (os.getenv("MONGODB_URI") or os.getenv("MONGO_URL") or "").strip()
    if not uri:
        logger.warning("MONGODB_URI is not set; Google auth and user data are disabled")
        return

    db_name = (
        (os.getenv("MONGODB_DB") or os.getenv("DB_NAME") or "mystix").strip() or "mystix"
    )
    _client = AsyncIOMotorClient(
        uri,
        serverSelectionTimeoutMS=8000,
        connectTimeoutMS=8000,
        socketTimeoutMS=15000,
    )
    _db = _client[db_name]
    await _db.command("ping")
    await _db.users.create_index("google_id", unique=True, sparse=True)
    await _db.users.create_index("email", unique=True, sparse=True)
    await _db.auth_codes.create_index("code", unique=True)
    await _db.auth_codes.create_index("expires_at", expireAfterSeconds=0)
    await _db.password_resets.create_index("email")
    await _db.password_resets.create_index("expires_at", expireAfterSeconds=0)
    await _db.history.create_index([("user_id", 1), ("item.id", 1)], unique=True)
    await _db.history.create_index([("user_id", 1), ("item.date", -1)])
    await _db.meditations.create_index("slug", unique=True)
    await _db.meditations.create_index([("published", 1), ("sort", 1)])
    await _db.meditations.create_index("tags")
    await _db.tarot_spreads.create_index("slug", unique=True)
    await _db.tarot_spreads.create_index([("published", 1), ("sort", 1)])
    await _db.support_requests.create_index([("status", 1), ("created_at", -1)])
    await _db.support_requests.create_index([("user_id", 1), ("created_at", -1)])
    await _db.support_requests.create_index([("email", 1), ("created_at", -1)])
    await _db.support_requests.create_index([("ip_hash", 1), ("created_at", -1)])
    logger.info("MongoDB connected | db=%s", db_name)


async def close_db() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


async def ping_db() -> dict[str, Any]:
    if _db is None:
        return {"ok": False, "configured": mongo_configured()}
    try:
        await asyncio.wait_for(_db.command("ping"), timeout=3)
        return {"ok": True, "configured": True}
    except Exception as exc:
        logger.warning("MongoDB ping failed: %s", exc)
        return {"ok": False, "configured": True}
