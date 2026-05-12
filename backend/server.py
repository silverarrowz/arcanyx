from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
from pydantic import BaseModel, Field, ValidationError
from typing import List, Optional, Dict, Tuple, Any
import os
import json
import logging
import hashlib
import random
import time
import requests


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

logger.info(
    "Mistral config | api_key_present=%s | agent_id_present=%s | agent_id_prefix=%s",
    bool(os.getenv("MISTRAL_API_KEY")),
    bool(os.getenv("MISTRAL_AGENT_ID")),
    (os.getenv("MISTRAL_AGENT_ID") or "")[:10],
)

app = FastAPI()
api_router = APIRouter(prefix="/api")

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


@api_router.get("/")
async def root():
    return {"message": "API is running"}


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


app.include_router(api_router)