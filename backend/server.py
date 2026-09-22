from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError, model_validator
from typing import List, Optional, Dict, Tuple, Any
import os
import json
import logging
import hashlib
import random
import time
import uuid
import requests

from admin import page_router as admin_page_router, router as admin_router
from admin_tarot_spreads import router as admin_tarot_spreads_router
from auth import router as auth_router
from db import close_db, connect_db, ping_db
from meditations import media_root, router as meditations_router, seed_meditations
from storage import s3_configured, upload_bytes
from tarot_chat import router as tarot_chat_router
from tarot_spreads import router as tarot_spreads_router, seed_tarot_spreads

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

logger.info(
    "Mistral config | api_key_present=%s | agent_id_present=%s | agent_id_prefix=%s | tarot_agent_id_present=%s | tarot_agent_id_prefix=%s",
    bool(os.getenv("MISTRAL_API_KEY")),
    bool(os.getenv("MISTRAL_AGENT_ID")),
    (os.getenv("MISTRAL_AGENT_ID") or "")[:10],
    bool(os.getenv("MISTRAL_TAROT_AGENT_ID")),
    (os.getenv("MISTRAL_TAROT_AGENT_ID") or "")[:10],
)

@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        await connect_db()
        await seed_meditations()
        await seed_tarot_spreads()
    except Exception:
        logger.exception("MongoDB connection failed at startup")
    yield
    await close_db()


app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(meditations_router)
api_router.include_router(tarot_chat_router)
api_router.include_router(tarot_spreads_router)
api_router.include_router(admin_router)
api_router.include_router(admin_tarot_spreads_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],  # For production, replace with your frontend URL.
    allow_methods=["*"],
    allow_headers=["*"],
)

DREAM_INTERPRET_CACHE_TTL_SECONDS = 600
dream_interpret_cache: Dict[str, Tuple[float, "DreamInterpretResponse"]] = {}

RETRYABLE_HTTP_STATUSES = {408, 409, 429, 500, 502, 503, 504}

MISTRAL_REQUEST_TIMEOUT_SECONDS = 45
MISTRAL_MAX_ATTEMPTS = 3

DEBUG_AI_ERRORS = os.getenv("DEBUG_AI_ERRORS", "false").lower() == "true"


class DreamInterpretRequest(BaseModel):
    dream_text: str = Field(min_length=1, max_length=3000)
    language: str = Field(default="ru")
    timezone: Optional[str] = None


class DreamInterpretResponse(BaseModel):
    title: str
    interpretation: str
    symbols: List[str]
    advice: str
    provider: str = "mistral"
    fallback: bool = False


DEFAULT_FAL_IMAGE_MODEL = "fal-ai/flux/schnell"

DREAM_ILLUSTRATION_SUPPORTED_IMAGE_SIZES: List[str] = [
    "square_hd",
    "square",
    "portrait_4_3",
    "portrait_16_9",
    "landscape_4_3",
    "landscape_16_9",
]

MAX_DREAM_ILLUSTRATION_NUM_IMAGES = 2


class DreamIllustrationRequest(BaseModel):
    dream_text: str = Field(min_length=1, max_length=1500)
    title: Optional[str] = None
    symbols: Optional[List[str]] = None
    image_size: str = "square_hd"
    num_images: int = Field(default=1, ge=1, le=2)
    seed: Optional[int] = None
    output_format: str = "png"

    @model_validator(mode="after")
    def validate_illustration_options(self) -> "DreamIllustrationRequest":
        if self.image_size not in DREAM_ILLUSTRATION_SUPPORTED_IMAGE_SIZES:
            raise ValueError(
                "image_size must be one of: "
                + ", ".join(DREAM_ILLUSTRATION_SUPPORTED_IMAGE_SIZES)
            )
        if self.output_format not in ("jpeg", "png"):
            raise ValueError("output_format must be 'jpeg' or 'png'")
        return self


class DreamIllustrationImage(BaseModel):
    url: str
    width: Optional[int] = None
    height: Optional[int] = None
    content_type: Optional[str] = None


class DreamIllustrationResponse(BaseModel):
    images: List[DreamIllustrationImage]
    provider: str = "fal"
    model: str
    seed: Optional[int] = None
    has_nsfw_concepts: Optional[List[bool]] = None


class DreamIllustrationConfigResponse(BaseModel):
    provider: str
    model: str
    has_fal_key: bool
    fal_key_length: int
    supported_image_sizes: List[str]
    max_num_images: int


def get_fal_client():
    try:
        import fal_client

        return fal_client
    except ImportError as exc:
        logger.exception("fal-client is not installed")
        raise HTTPException(
            status_code=500,
            detail="fal-client is not installed on the server",
        ) from exc


def build_fallback_response() -> DreamInterpretResponse:
    return DreamInterpretResponse(
        title="Сон сохранён для повторного толкования",
        interpretation=(
            "Сейчас сервис толкования временно недоступен. "
            "Попробуйте получить интерпретацию немного позже."
        ),
        symbols=[],
        advice="Попробуйте повторить запрос позже.",
        provider="fallback",
        fallback=True,
    )


def make_cache_key(payload: DreamInterpretRequest) -> str:
    normalized_dream_text = payload.dream_text.strip()
    cache_source = f"{normalized_dream_text}|{payload.language}|{payload.timezone or ''}"
    return hashlib.sha256(cache_source.encode("utf-8")).hexdigest()


def strip_json_markdown(text: str) -> str:
    text = text.strip()

    if text.startswith("```json"):
        text = text.removeprefix("```json").strip()

    if text.startswith("```"):
        text = text.removeprefix("```").strip()

    if text.endswith("```"):
        text = text.removesuffix("```").strip()

    return text


def normalize_text_field(value: Any) -> str:
    """
    Mistral Agent may sometimes return a string[] even if schema says string.
    This keeps your API response stable for the mobile app.
    """
    if value is None:
        return ""

    if isinstance(value, list):
        return " ".join(
            str(item).strip()
            for item in value
            if str(item).strip()
        ).strip()

    if isinstance(value, str):
        return value.strip()

    return str(value).strip()


def normalize_symbols(value: Any) -> List[str]:
    if value is None:
        return []

    if isinstance(value, list):
        symbols = []
        for item in value:
            normalized = normalize_text_field(item)
            if normalized:
                symbols.append(normalized)
        return symbols

    if isinstance(value, str):
        # If Mistral accidentally returns "дом, река, дверь"
        return [
            item.strip()
            for item in value.split(",")
            if item.strip()
        ]

    return []


def get_retry_after_seconds(response: Optional[requests.Response]) -> Optional[float]:
    if response is None:
        return None

    retry_after = response.headers.get("Retry-After")

    if not retry_after:
        return None

    try:
        return max(0.0, float(retry_after))
    except ValueError:
        return None


def get_backoff_delay_seconds(
    attempt_index: int,
    response: Optional[requests.Response] = None,
) -> float:
    retry_after_seconds = get_retry_after_seconds(response)

    if retry_after_seconds is not None:
        return min(retry_after_seconds, 10.0)

    base_delay = 0.8 * (2 ** attempt_index)
    jitter = random.uniform(0.2, 0.8)

    return min(base_delay + jitter, 10.0)


def is_retryable_http_error(exc: requests.HTTPError) -> bool:
    status_code = exc.response.status_code if exc.response is not None else None
    return status_code in RETRYABLE_HTTP_STATUSES


def build_mistral_request_body(payload: DreamInterpretRequest) -> dict:
    normalized_dream_text = payload.dream_text.strip()

    user_payload = {
        "dream_text": normalized_dream_text,
        "language": payload.language,
        "timezone": payload.timezone,
    }

    return {
        "agent_id": os.getenv("MISTRAL_AGENT_ID"),
        "messages": [
            {
                "role": "user",
                "content": (
                    "Истолкуй сон по этим данным пользователя. "
                    "В interpretation и advice обращайся на «вы» и гендерно нейтрально. "
                    "Верни только JSON по заданной схеме агента. "
                    "Поля interpretation и advice должны быть строками, не массивами. "
                    "Только symbols должен быть массивом.\n\n"
                    f"{json.dumps(user_payload, ensure_ascii=False)}"
                ),
            }
        ],
        "stream": False,
        "max_tokens": 900,
    }


def parse_mistral_response(body: dict) -> DreamInterpretResponse:
    content = (
        body.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )

    if not content:
        logger.error("Mistral returned empty content | body=%s", body)
        raise ValueError("Mistral returned an empty response")

    if isinstance(content, list):
        text = "".join(
            part.get("text", "")
            for part in content
            if isinstance(part, dict)
        ).strip()
    else:
        text = str(content).strip()

    logger.info("Mistral raw content | content=%s", text[:3000])

    text = strip_json_markdown(text)

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        logger.error("Mistral content is not valid JSON | text=%s", text[:3000])
        raise

    logger.info(
        "Mistral parsed JSON before normalization | parsed=%s",
        json.dumps(parsed, ensure_ascii=False)[:3000],
    )

    # Defensive normalization: backend response stays stable even if model returns arrays.
    parsed["title"] = normalize_text_field(parsed.get("title", ""))
    parsed["interpretation"] = normalize_text_field(parsed.get("interpretation", ""))
    parsed["advice"] = normalize_text_field(parsed.get("advice", ""))
    parsed["symbols"] = normalize_symbols(parsed.get("symbols", []))

    try:
        interpreted = DreamInterpretResponse(**parsed)
    except ValidationError:
        logger.error(
            "Mistral JSON did not match DreamInterpretResponse after normalization | parsed=%s",
            json.dumps(parsed, ensure_ascii=False)[:3000],
        )
        raise

    interpreted.provider = f"mistral:{body.get('model', 'agent')}"
    interpreted.fallback = False

    return interpreted


def call_mistral_once(
    api_key: str,
    request_body: dict,
) -> DreamInterpretResponse:
    url = "https://api.mistral.ai/v1/agents/completions"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    response = requests.post(
        url,
        headers=headers,
        json=request_body,
        timeout=MISTRAL_REQUEST_TIMEOUT_SECONDS,
    )

    if not response.ok:
        logger.error(
            "Mistral HTTP error | status=%s | body=%s",
            response.status_code,
            response.text[:3000],
        )
        response.raise_for_status()

    body = response.json()

    return parse_mistral_response(body)


def call_mistral_with_retries(
    api_key: str,
    request_body: dict,
) -> DreamInterpretResponse:
    last_error: Optional[Exception] = None

    for attempt_index in range(MISTRAL_MAX_ATTEMPTS):
        attempt_number = attempt_index + 1

        try:
            logger.info(
                "Calling Mistral Agent | attempt=%s/%s",
                attempt_number,
                MISTRAL_MAX_ATTEMPTS,
            )

            return call_mistral_once(
                api_key=api_key,
                request_body=request_body,
            )

        except requests.HTTPError as exc:
            last_error = exc
            status_code = exc.response.status_code if exc.response is not None else None

            if not is_retryable_http_error(exc):
                logger.warning(
                    "Non-retryable Mistral HTTP error | status=%s",
                    status_code,
                )
                raise

            if attempt_index == MISTRAL_MAX_ATTEMPTS - 1:
                logger.warning(
                    "Mistral retryable HTTP error exhausted | status=%s",
                    status_code,
                )
                break

            delay = get_backoff_delay_seconds(attempt_index, exc.response)

            logger.warning(
                "Mistral retryable HTTP error | status=%s | retry_in=%.2fs",
                status_code,
                delay,
            )

            time.sleep(delay)

        except (requests.Timeout, requests.ConnectionError) as exc:
            last_error = exc

            if attempt_index == MISTRAL_MAX_ATTEMPTS - 1:
                logger.warning("Mistral network error exhausted | error=%s", exc)
                break

            delay = get_backoff_delay_seconds(attempt_index)

            logger.warning(
                "Mistral network error | error=%s | retry_in=%.2fs",
                exc,
                delay,
            )

            time.sleep(delay)

        except (ValueError, json.JSONDecodeError, ValidationError) as exc:
            last_error = exc

            if attempt_index == MISTRAL_MAX_ATTEMPTS - 1:
                logger.warning(
                    "Mistral parsing/validation error exhausted | error=%s",
                    exc,
                )
                break

            delay = get_backoff_delay_seconds(attempt_index)

            logger.warning(
                "Mistral parsing/validation error | retry_in=%.2fs | error=%s",
                delay,
                exc,
            )

            time.sleep(delay)

    if last_error:
        raise last_error

    raise RuntimeError("Mistral failed without a captured error")


def mistral_interpret_dream_sync(payload: DreamInterpretRequest) -> DreamInterpretResponse:
    api_key = os.getenv("MISTRAL_API_KEY")
    agent_id = os.getenv("MISTRAL_AGENT_ID")

    if not api_key:
        logger.warning("MISTRAL_API_KEY is not configured, returning fallback response")
        return build_fallback_response()

    if not agent_id:
        logger.warning("MISTRAL_AGENT_ID is not configured, returning fallback response")
        return build_fallback_response()

    normalized_dream_text = payload.dream_text.strip()

    if not normalized_dream_text:
        raise HTTPException(status_code=400, detail="dream_text must not be empty")

    cache_key = make_cache_key(payload)

    cached_entry = dream_interpret_cache.get(cache_key)
    now_s = time.time()

    if cached_entry and now_s - cached_entry[0] <= DREAM_INTERPRET_CACHE_TTL_SECONDS:
        cached = cached_entry[1].model_copy(deep=True)
        cached.provider = f"{cached.provider}:cache"
        return cached

    request_body = build_mistral_request_body(payload)

    interpreted = call_mistral_with_retries(
        api_key=api_key,
        request_body=request_body,
    )

    dream_interpret_cache[cache_key] = (
        time.time(),
        interpreted.model_copy(deep=True),
    )

    return interpreted


def build_dream_illustration_prompt(payload: DreamIllustrationRequest) -> str:
    dream_text = payload.dream_text.strip()
    title = payload.title.strip() if payload.title else ""
    symbols = payload.symbols or []

    cleaned_symbols: List[str] = []
    for s in symbols:
        normalized = str(s).strip() if s is not None else ""
        if normalized:
            cleaned_symbols.append(normalized)

    parts: List[str] = []

    if title:
        parts.append(f"Title:\n{title}")

    if cleaned_symbols:
        parts.append("Symbols:\n" + ", ".join(cleaned_symbols))

    parts.append(f"Dream text:\n{dream_text}")

    visual = (
        "Visual direction:\n"
        "Create a symbolic dream illustration for a mystical mobile app.\n"
        "Use the dream text as inspiration, but do not illustrate it too literally.\n"
        "Focus on atmosphere, symbolic objects, emotional tone, and visual metaphor.\n"
        "The image should feel poetic, soft, surreal, and psychologically meaningful.\n"
        "Avoid horror, gore, violence, sexual content, realistic fear, or disturbing imagery.\n"
        "Blender-style 3D illustration.\n"
        "Soft cinematic lighting.\n"
        "Dark ethereal palette with deep violet, muted lavender, soft moonlight, "
        "and subtle golden accents.\n"
        "Calm mist, dreamlike depth, elegant negative space, premium modern app aesthetic.\n"
        "No text, no letters, no watermark, no UI elements."
    )
    parts.append(visual)

    return "\n\n".join(parts)


def _fal_result_for_error_log(result: Any) -> Any:
    """Avoid echoing provider prompt (may contain personal dream text) into logs."""
    if not isinstance(result, dict):
        return result
    redacted = dict(result)
    prompt_val = redacted.get("prompt")
    if isinstance(prompt_val, str):
        redacted["prompt"] = f"[omitted, length={len(prompt_val)}]"
    return redacted


def parse_fal_illustration_response(result: Any, model: str) -> DreamIllustrationResponse:
    if not isinstance(result, dict):
        logger.error(
            "fal.ai returned non-dict result | type=%s",
            type(result).__name__,
        )
        raise ValueError(
            f"fal.ai returned unexpected result type: {type(result).__name__}"
        )

    images_raw = result.get("images")
    if not images_raw:
        logger.error(
            "fal.ai returned no images | result=%s",
            json.dumps(_fal_result_for_error_log(result), ensure_ascii=False, default=str)[:8000],
        )
        raise ValueError("fal.ai returned no images")

    if not isinstance(images_raw, list):
        logger.error(
            "fal.ai images field is not a list | result=%s",
            json.dumps(_fal_result_for_error_log(result), ensure_ascii=False, default=str)[:8000],
        )
        raise ValueError("fal.ai returned no images")

    images: List[DreamIllustrationImage] = []
    for item in images_raw:
        if not isinstance(item, dict):
            continue
        url = item.get("url")
        if not url or not isinstance(url, str):
            continue
        w = item.get("width")
        h = item.get("height")
        ct = item.get("content_type")
        images.append(
            DreamIllustrationImage(
                url=url,
                width=w if isinstance(w, int) else None,
                height=h if isinstance(h, int) else None,
                content_type=ct if isinstance(ct, str) else None,
            )
        )

    if not images:
        logger.error(
            "fal.ai returned no usable image URLs | result=%s",
            json.dumps(_fal_result_for_error_log(result), ensure_ascii=False, default=str)[:8000],
        )
        raise ValueError("fal.ai returned no images")

    raw_seed = result.get("seed")
    seed: Optional[int] = None
    if isinstance(raw_seed, int):
        seed = raw_seed
    elif raw_seed is not None:
        try:
            seed = int(raw_seed)
        except (TypeError, ValueError):
            seed = None

    raw_nsfw = result.get("has_nsfw_concepts")
    has_nsfw_concepts: Optional[List[bool]] = None
    if isinstance(raw_nsfw, list):
        parsed_flags: List[bool] = []
        for x in raw_nsfw:
            if isinstance(x, bool):
                parsed_flags.append(x)
            elif x in (0, 1):
                parsed_flags.append(bool(x))
        has_nsfw_concepts = parsed_flags

    return DreamIllustrationResponse(
        images=images,
        provider="fal",
        model=model,
        seed=seed,
        has_nsfw_concepts=has_nsfw_concepts,
    )


def _illustration_extension(url: str, content_type: Optional[str]) -> str:
    lowered_type = (content_type or "").lower()
    lowered_url = url.lower()
    if "jpeg" in lowered_type or "jpg" in lowered_type or lowered_url.endswith((".jpg", ".jpeg")):
        return ".jpg"
    if "webp" in lowered_type or lowered_url.endswith(".webp"):
        return ".webp"
    return ".png"


def persist_dream_illustration_url(url: str, content_type: Optional[str]) -> str:
    """Copy fal CDN files to S3 so diary images outlive fal's 24h TTL."""
    if not s3_configured():
        return url
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.content
        if not data:
            return url

        filename = f"{uuid.uuid4().hex}{_illustration_extension(url, content_type)}"
        uploaded = upload_bytes(
            data,
            f"dreams/{filename}",
            content_type=content_type or "image/png",
        )
        stored = uploaded.get("url") or ""
        if stored:
            return stored
    except Exception:
        logger.exception("Failed to persist fal illustration, keeping provider URL")
    return url


def generate_dream_illustration_sync(payload: DreamIllustrationRequest) -> DreamIllustrationResponse:
    fal_key = os.getenv("FAL_KEY")
    if not fal_key:
        raise HTTPException(status_code=500, detail="FAL_KEY is not configured")

    fal_client = get_fal_client()

    model = os.getenv("FAL_IMAGE_MODEL") or DEFAULT_FAL_IMAGE_MODEL
    final_prompt = build_dream_illustration_prompt(payload)

    arguments: Dict[str, Any] = {
        "prompt": final_prompt,
        "image_size": payload.image_size,
        "num_images": payload.num_images,
        "num_inference_steps": 4,
        "output_format": payload.output_format,
        "enable_safety_checker": True,
    }
    if payload.seed is not None:
        arguments["seed"] = payload.seed

    logger.info(
        "Calling fal.ai | model=%s | image_size=%s | num_images=%s | output_format=%s | prompt_length=%s",
        model,
        payload.image_size,
        payload.num_images,
        payload.output_format,
        len(final_prompt),
    )

    try:
        result = fal_client.subscribe(
            model,
            arguments=arguments,
            with_logs=True,
        )
    except Exception as exc:
        logger.exception("fal.ai dream illustration subscribe failed: %s", exc)
        raise RuntimeError(str(exc)) from exc

    try:
        parsed = parse_fal_illustration_response(result, model)
    except ValueError as exc:
        raise RuntimeError(str(exc)) from exc

    persisted: List[DreamIllustrationImage] = []
    for image in parsed.images:
        persisted.append(
            image.model_copy(
                update={"url": persist_dream_illustration_url(image.url, image.content_type)}
            )
        )
    return parsed.model_copy(update={"images": persisted})


def probe_outbound_url(url: str, timeout_seconds: float = 8.0) -> dict:
    try:
        response = requests.get(url, timeout=timeout_seconds)
        return {
            "reachable": True,
            "status_code": response.status_code,
        }
    except requests.RequestException as exc:
        return {
            "reachable": False,
            "error": exc.__class__.__name__,
            "message": str(exc)[:300],
        }


@api_router.get("/")
async def root():
    return {"message": "API is running"}


@api_router.get("/health")
async def health():
    mongo = await ping_db()
    return {
        "ok": True,
        "service": "mystix-api",
        "mistral_api_key": bool(os.getenv("MISTRAL_API_KEY")),
        "mistral_agent_id": bool(os.getenv("MISTRAL_AGENT_ID")),
        "mistral_tarot_agent_id": bool(os.getenv("MISTRAL_TAROT_AGENT_ID")),
        "fal_key": bool(os.getenv("FAL_KEY")),
        "mongodb": mongo,
        "google_auth": bool(
            (os.getenv("GOOGLE_CLIENT_ID") or "").strip()
            and (os.getenv("GOOGLE_CLIENT_SECRET") or "").strip()
        ),
    }


@api_router.get("/health/outbound")
async def health_outbound():
    """Check whether this host can reach Mistral and fal.ai (useful on RU VPS)."""
    return {
        "mistral": probe_outbound_url("https://api.mistral.ai/v1/models"),
        "fal": probe_outbound_url("https://fal.run"),
    }


@api_router.post("/dreams/interpret", response_model=DreamInterpretResponse)
async def interpret_dream(input: DreamInterpretRequest):
    dream_text = input.dream_text.strip()

    if not dream_text:
        raise HTTPException(status_code=400, detail="dream_text must not be empty")

    try:
        return await run_in_threadpool(mistral_interpret_dream_sync, input)

    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else None
        response_text = exc.response.text if exc.response is not None else ""

        logger.exception(
            "Mistral HTTP error after retries | status=%s | body=%s",
            status_code,
            response_text[:3000],
        )

        if DEBUG_AI_ERRORS:
            raise HTTPException(
                status_code=500,
                detail={
                    "type": "mistral_http_error",
                    "status_code": status_code,
                    "body": response_text[:3000],
                },
            )

        return build_fallback_response()

    except Exception as exc:
        logger.exception("Dream interpretation failed: %s", exc)

        if DEBUG_AI_ERRORS:
            raise HTTPException(
                status_code=500,
                detail={
                    "type": exc.__class__.__name__,
                    "message": str(exc),
                },
            )

        return build_fallback_response()


@api_router.post("/dreams/illustrate", response_model=DreamIllustrationResponse)
async def illustrate_dream(input: DreamIllustrationRequest):
    try:
        return await run_in_threadpool(generate_dream_illustration_sync, input)
    except HTTPException:
        raise
    except Exception as exc:
        # TEMPORARY: sanitized debug in response; remove after fixing fal integration.
        logger.exception("Dream illustration generation failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail={
                "message": "Dream illustration generation failed",
                "error_type": type(exc).__name__,
                "error_message": str(exc)[:1000],
            },
        ) from exc


@api_router.get("/dreams/illustrate/config", response_model=DreamIllustrationConfigResponse)
async def dream_illustration_config():
    fal_key = os.getenv("FAL_KEY") or ""
    model = os.getenv("FAL_IMAGE_MODEL") or DEFAULT_FAL_IMAGE_MODEL
    return DreamIllustrationConfigResponse(
        provider="fal",
        model=model,
        has_fal_key=bool(fal_key),
        fal_key_length=len(fal_key),
        supported_image_sizes=list(DREAM_ILLUSTRATION_SUPPORTED_IMAGE_SIZES),
        max_num_images=MAX_DREAM_ILLUSTRATION_NUM_IMAGES,
    )


app.include_router(api_router)
app.include_router(admin_page_router)
app.mount("/media", StaticFiles(directory=str(media_root())), name="media")