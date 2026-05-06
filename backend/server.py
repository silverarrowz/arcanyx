from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
from pydantic import BaseModel, Field, ValidationError
from typing import List, Optional, Dict, Tuple
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

RETRYABLE_HTTP_STATUSES = {429, 500, 502, 503, 504}

GEMINI_REQUEST_TIMEOUT_SECONDS = 35
GEMINI_MAX_RETRIES_PER_MODEL = 3
GEMINI_FALLBACK_MODEL_RETRIES = 2


class DreamInterpretRequest(BaseModel):
    dream_text: str = Field(min_length=1, max_length=1500)
    language: str = Field(default="ru")
    timezone: Optional[str] = None


class DreamInterpretResponse(BaseModel):
    title: str
    interpretation: str
    symbols: List[str]
    advice: str
    provider: str = "gemini"
    fallback: bool = False


def build_fallback_response() -> DreamInterpretResponse:
    return DreamInterpretResponse(
        title="Сон сохранён для повторного толкования",
        interpretation=(
            "Сейчас сервис толкования временно перегружен, поэтому не удалось "
            "получить персональную интерпретацию. Сон можно попробовать истолковать "
            "ещё раз немного позже."
        ),
        symbols=[],
        advice=(
            "Попробуйте повторить запрос позже. Бесплатную попытку лучше считать "
            "использованной только после успешного толкования."
        ),
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


def get_models_to_try() -> List[str]:
    primary_model = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview").strip()
    fallback_model = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash").strip()
    second_fallback_model = os.getenv("GEMINI_SECOND_FALLBACK_MODEL", "").strip()

    models: List[str] = []

    for model in [primary_model, fallback_model, second_fallback_model]:
        if model and model not in models:
            models.append(model)

    return models


def build_gemini_request_body(payload: DreamInterpretRequest) -> dict:
    normalized_dream_text = payload.dream_text.strip()

    system_prompt = (
        "Ты эмпатичный толкователь снов с психологическим, символическим подходом. "
        "Ответь строго JSON-объектом без markdown. "
        "Поля: title, interpretation, symbols, advice. "

        "Смотри на сон не как на предсказание, а как на образ внутреннего состояния человека. "
        "Интерпретация должна звучать как психологическое размышление, но понятно для пользователя. "
        "Обращай внимание на символы, внутренние противоречия, желания, страхи, границы, переходы, отношения с собой и миром. "
        "Не используй диагнозы, мистическое запугивание и категоричные утверждения. Формулируй мягко. "

        "title: краткий заголовок до 8 слов. "

        "interpretation: 5-6 коротких предложений. "
        "Пиши образно, но ясно. "
        "Не пересказывай сон целиком, а связывай его образы с возможными внутренними переживаниями. "

        "symbols: массив из 3-6 простых конкретных символов из самого сна на русском. "
        "Это должны быть значимые объекты, места, существа, действия или события, явно присутствующие в тексте сна. "
        "Хорошие примеры: дом, вода, река, полёт, погоня, переезд, лес, поезд, ребёнок, собака. "
        "Плохие примеры: внутренний ребёнок, скрытая тайна, эмоциональное спокойствие, страх перемен, поиск себя. "
        "Каждый символ должен быть 1-2 слова, в именительном падеже, без лишних прилагательных. "
        "Не добавляй абстрактные темы, эмоции или интерпретации в symbols. "

        "advice: 1-2 предложения. "
        "Совет должен быть мягким, практичным и психологически бережным. "

        "Не используй гендерно-маркированные формулировки. "
        "Не обращайся к пользователю в женском или мужском роде. "
        "Избегай слов вроде: сама, сам, готова, готов, устала, устал, почувствовала, почувствовал. "
        "Используй нейтральные формулировки: 'о себе', 'внутри себя', 'может быть важно', 'стоит обратить внимание'."
    )

    user_payload = {
        "dream_text": normalized_dream_text,
        "language": payload.language,
        "timezone": payload.timezone,
    }

    return {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            f"{system_prompt}\n\n"
                            f"Данные пользователя:\n"
                            f"{json.dumps(user_payload, ensure_ascii=False)}"
                        )
                    }
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.65,
            "maxOutputTokens": 900,
            "responseMimeType": "application/json",
        },
    }


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


def is_retryable_http_error(exc: requests.HTTPError) -> bool:
    status_code = exc.response.status_code if exc.response is not None else None
    return status_code in RETRYABLE_HTTP_STATUSES


def is_retryable_request_error(exc: requests.RequestException) -> bool:
    return isinstance(
        exc,
        (
            requests.Timeout,
            requests.ConnectionError,
        ),
    )


def get_backoff_delay_seconds(
    attempt_index: int,
    response: Optional[requests.Response] = None,
) -> float:
    retry_after_seconds = get_retry_after_seconds(response)

    if retry_after_seconds is not None:
        return min(retry_after_seconds, 8.0)

    base_delay = 0.8 * (2 ** attempt_index)
    jitter = random.uniform(0.1, 0.7)

    return min(base_delay + jitter, 8.0)


def parse_gemini_response(
    body: dict,
    model_name: str,
) -> DreamInterpretResponse:
    text = (
        body.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "")
        .strip()
    )

    if not text:
        logger.error("Gemini returned empty text | model=%s | body=%s", model_name, body)
        raise ValueError("Gemini returned an empty response")

    text = strip_json_markdown(text)

    parsed = json.loads(text)
    interpreted = DreamInterpretResponse(**parsed)
    interpreted.fallback = False
    interpreted.provider = f"gemini:{model_name}"

    return interpreted


def call_gemini_model_once(
    model_name: str,
    api_key: str,
    request_body: dict,
) -> DreamInterpretResponse:
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model_name}:generateContent"
    )

    headers = {
        "x-goog-api-key": api_key,
        "Content-Type": "application/json",
    }

    response = requests.post(
        url,
        headers=headers,
        json=request_body,
        timeout=GEMINI_REQUEST_TIMEOUT_SECONDS,
    )

    if not response.ok:
        logger.error(
            "Gemini HTTP error | model=%s | status=%s | body=%s",
            model_name,
            response.status_code,
            response.text[:1000],
        )
        response.raise_for_status()

    body = response.json()
    return parse_gemini_response(body=body, model_name=model_name)


def call_gemini_model_with_retries(
    model_name: str,
    api_key: str,
    request_body: dict,
    max_attempts: int,
) -> DreamInterpretResponse:
    last_error: Optional[Exception] = None

    for attempt_index in range(max_attempts):
        attempt_number = attempt_index + 1

        try:
            logger.info(
                "Calling Gemini | model=%s | attempt=%s/%s",
                model_name,
                attempt_number,
                max_attempts,
            )

            return call_gemini_model_once(
                model_name=model_name,
                api_key=api_key,
                request_body=request_body,
            )

        except requests.HTTPError as exc:
            last_error = exc
            status_code = exc.response.status_code if exc.response is not None else None

            if not is_retryable_http_error(exc):
                logger.warning(
                    "Non-retryable Gemini HTTP error | model=%s | status=%s",
                    model_name,
                    status_code,
                )
                raise

            if attempt_index == max_attempts - 1:
                logger.warning(
                    "Gemini retryable HTTP error exhausted | model=%s | status=%s",
                    model_name,
                    status_code,
                )
                break

            delay = get_backoff_delay_seconds(attempt_index, exc.response)

            logger.warning(
                "Gemini retryable HTTP error | model=%s | status=%s | retry_in=%.2fs",
                model_name,
                status_code,
                delay,
            )

            time.sleep(delay)

        except requests.RequestException as exc:
            last_error = exc

            if not is_retryable_request_error(exc):
                logger.warning(
                    "Non-retryable Gemini request error | model=%s | error=%s",
                    model_name,
                    exc,
                )
                raise

            if attempt_index == max_attempts - 1:
                logger.warning(
                    "Gemini request error exhausted | model=%s | error=%s",
                    model_name,
                    exc,
                )
                break

            delay = get_backoff_delay_seconds(attempt_index)

            logger.warning(
                "Gemini request error | model=%s | error=%s | retry_in=%.2fs",
                model_name,
                exc,
                delay,
            )

            time.sleep(delay)

        except (ValueError, json.JSONDecodeError, ValidationError) as exc:
            last_error = exc

            # JSON/parsing issues are sometimes temporary model output issues.
            # Retry once or twice before switching models.
            if attempt_index == max_attempts - 1:
                logger.warning(
                    "Gemini parsing/validation error exhausted | model=%s | error=%s",
                    model_name,
                    exc,
                )
                break

            delay = get_backoff_delay_seconds(attempt_index)

            logger.warning(
                "Gemini parsing/validation error | model=%s | retry_in=%.2fs | error=%s",
                model_name,
                delay,
                exc,
            )

            time.sleep(delay)

    if last_error:
        raise last_error

    raise RuntimeError(f"Gemini failed without a captured error for model={model_name}")


def call_gemini_with_model_fallbacks(
    api_key: str,
    request_body: dict,
    cache_key: str,
) -> DreamInterpretResponse:
    models_to_try = get_models_to_try()

    if not models_to_try:
        raise RuntimeError("No Gemini models configured")

    last_error: Optional[Exception] = None

    for model_index, model_name in enumerate(models_to_try):
        try:
            max_attempts = (
                GEMINI_MAX_RETRIES_PER_MODEL
                if model_index == 0
                else GEMINI_FALLBACK_MODEL_RETRIES
            )

            if model_index > 0:
                logger.warning(
                    "Switching to Gemini fallback model | model=%s",
                    model_name,
                )

            interpreted = call_gemini_model_with_retries(
                model_name=model_name,
                api_key=api_key,
                request_body=request_body,
                max_attempts=max_attempts,
            )

            dream_interpret_cache[cache_key] = (
                time.time(),
                interpreted.model_copy(deep=True),
            )

            return interpreted

        except requests.HTTPError as exc:
            last_error = exc
            status_code = exc.response.status_code if exc.response is not None else None

            # If model does not exist or is not available for your account/region,
            # try the next configured fallback model.
            if status_code in (404,):
                logger.warning(
                    "Gemini model unavailable, trying next model | model=%s | status=%s",
                    model_name,
                    status_code,
                )
                continue

            # Bad request usually means prompt/config/schema issue.
            # No fallback model will fix that.
            if status_code == 400:
                logger.error(
                    "Gemini bad request. Not trying fallback models | model=%s | body=%s",
                    model_name,
                    exc.response.text[:1000] if exc.response is not None else "",
                )
                raise

            logger.warning(
                "Gemini model failed, trying next model if available | model=%s | status=%s",
                model_name,
                status_code,
            )
            continue

        except (requests.RequestException, ValueError, json.JSONDecodeError, ValidationError) as exc:
            last_error = exc
            logger.warning(
                "Gemini model failed, trying next model if available | model=%s | error=%s",
                model_name,
                exc,
            )
            continue

    if last_error:
        raise last_error

    raise RuntimeError("All Gemini models failed")


def gemini_interpret_dream_sync(payload: DreamInterpretRequest) -> DreamInterpretResponse:
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        logger.warning("GEMINI_API_KEY is not configured, returning fallback response")
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

    request_body = build_gemini_request_body(payload)

    return call_gemini_with_model_fallbacks(
        api_key=api_key,
        request_body=request_body,
        cache_key=cache_key,
    )


@api_router.get("/")
async def root():
    return {"message": "API is running"}


@api_router.post("/dreams/interpret", response_model=DreamInterpretResponse)
async def interpret_dream(input: DreamInterpretRequest):
    dream_text = input.dream_text.strip()

    if not dream_text:
        raise HTTPException(status_code=400, detail="dream_text must not be empty")

    try:
        return await run_in_threadpool(gemini_interpret_dream_sync, input)

    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else None

        logger.exception(
            "Gemini HTTP error after all retries/fallback models | status=%s",
            status_code,
        )

        return build_fallback_response()

    except (
        requests.RequestException,
        ValueError,
        KeyError,
        ValidationError,
        json.JSONDecodeError,
        RuntimeError,
    ) as exc:
        logger.exception(
            "Gemini interpretation failed after all retries/fallback models, returning fallback: %s",
            exc,
        )
        return build_fallback_response()


app.include_router(api_router)