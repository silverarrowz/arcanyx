#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")

from storage import _client, s3_bucket, upload_path  # noqa: E402
from tarot_spreads import read_tarot_spread_seed, seed_cover_key  # noqa: E402


def main() -> None:
    client = _client()
    bucket = s3_bucket()
    uploaded = 0
    skipped = 0
    for row in read_tarot_spread_seed():
        asset = ROOT / "frontend" / "assets" / "tarot" / "bg" / row["coverAsset"]
        if not asset.is_file():
            raise FileNotFoundError(asset)
        key = seed_cover_key(row["slug"], row["coverAsset"])
        try:
            client.head_object(Bucket=bucket, Key=key)
            skipped += 1
            continue
        except Exception:
            pass
        upload_path(asset, key, content_type="image/jpeg")
        uploaded += 1
    print(f"Tarot spread assets ready | uploaded={uploaded} skipped={skipped}")


if __name__ == "__main__":
    main()
