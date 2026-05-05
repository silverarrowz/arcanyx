from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ValidationError
from typing import List, Optional, Dict, Tuple
import uuid
from datetime import datetime
import json
import requests
import hashlib
import time


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

DREAM_INTERPRET_CACHE_TTL_SECONDS = 600
dream_interpret_cache: Dict[str, Tuple[float, "DreamInterpretResponse"]] = {}


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class DreamInterpretRequest(BaseModel):
    dream_text: str = Field(min_length=1, max_length=1500)
    language: str = Field(default="ru")
    timezone: Optional[str] = None

class DreamInterpretResponse(BaseModel):
    title: str
    interpretation: str
    symbols: List[str]
    advice: str
    disclaimer: str
    provider: str = "gemini"
    fallback: bool = False


def build_fallback_response() -> DreamInterpretResponse:
    return DreamInterpretResponse(
        title="Сон как отражение внутреннего состояния",
        interpretation=(
            "Похоже, этот сон связан с вашими текущими переживаниями и попыткой "
            "осмыслить важные эмоции. Повторяющиеся образы часто указывают на темы, "
            "которые требуют мягкого внимания и спокойного самоанализа."
        ),
        symbols=["эмоции", "перемены", "поиск смысла"],
        advice=(
            "Запишите ключевые детали сна и свои чувства после пробуждения. Это поможет "
            "заметить повторяющиеся мотивы и лучше понимать собственные реакции."
        ),
        disclaimer="Интерпретация носит справочный характер и не является медицинской рекомендацией.",
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

    models: List[str] = []

    for model in [primary_model, fallback_model, "gemini-2.5-flash"]:
        if model and model not in models:
            models.append(model)

    return models

def build_gemini_request_body(payload: DreamInterpretRequest) -> dict:
    normalized_dream_text = payload.dream_text.strip()

    system_prompt = (
        "Ты эмпатичный толкователь снов. "
        "Ответь строго JSON-объектом без markdown. "
        "Поля: title, interpretation, symbols, advice, disclaimer. "
        "title: краткий заголовок. "
        "interpretation: 2-4 предложения. "
        "symbols: массив из 3-6 коротких символов или тем на русском. "
        "advice: 1-2 предложения. "
        "disclaimer: короткий дисклеймер на русском, что это не медицинская диагностика. "
        "Тон: бережный, не категоричный, без мистического запугивания."
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
            "temperature": 0.6,
            "responseMimeType": "application/json",
        },
    }


def call_gemini_model(
    model_name: str,
    api_key: str,
    request_body: dict,
    cache_key: str,
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
        timeout=30,
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

    dream_interpret_cache[cache_key] = (
        time.time(),
        interpreted.model_copy(deep=True),
    )

    return interpreted

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
    models_to_try = get_models_to_try()

    last_error: Optional[Exception] = None

    for index, model_name in enumerate(models_to_try):
        try:
            if index > 0:
                logger.warning("Retrying Gemini with fallback model: %s", model_name)

            return call_gemini_model(
                model_name=model_name,
                api_key=api_key,
                request_body=request_body,
                cache_key=cache_key,
            )

        except requests.HTTPError as exc:
            status_code = exc.response.status_code if exc.response is not None else None
            last_error = exc

            if status_code in (400, 404):
                continue

            if status_code == 429:
                logger.warning("Gemini quota/rate limit reached")
                raise

            raise

        except (ValueError, json.JSONDecodeError, ValidationError) as exc:
            logger.exception("Gemini parsing/validation failed with model=%s", model_name)
            last_error = exc
            continue

    if last_error:
        raise last_error

    raise RuntimeError("No Gemini models available to process request")







# def gemini_interpret_dream(payload: DreamInterpretRequest) -> DreamInterpretResponse:
#     api_key = os.getenv("GEMINI_API_KEY")
#     if not api_key:
#         logger.warning("GEMINI_API_KEY is not configured, returning fallback response")
#         return build_fallback_response()
#     model_name = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview").strip() or "gemini-3-flash-preview"
#     fallback_model = (
#         os.getenv("GEMINI_FALLBACK_MODEL", "gemini-3-flash-preview").strip() or "gemini-3-flash-preview"
#     )
#     hard_fallback_model = "gemini-3-flash-preview"

#     normalized_dream_text = payload.dream_text.strip()
#     cache_source = f"{normalized_dream_text}|{payload.language}|{payload.timezone or ''}"
#     cache_key = hashlib.sha256(cache_source.encode("utf-8")).hexdigest()
#     now_s = time.time()
#     cached_entry = dream_interpret_cache.get(cache_key)
#     if cached_entry and now_s - cached_entry[0] <= DREAM_INTERPRET_CACHE_TTL_SECONDS:
#         cached = cached_entry[1].model_copy(deep=True)
#         cached.provider = f"{cached.provider}:cache"
#         return cached

#     prompt = (
#         "Ты эмпатичный толкователь снов. Ответь строго JSON-объектом без markdown. "
#         "Поля: title (краткий заголовок), interpretation (2-4 предложения), "
#         "symbols (массив 3-6 символов/тем), advice (1-2 предложения), "
#         "disclaimer (короткий дисклеймер на русском, что это не мед.диагностика). "
#         "Тон: бережный, не категоричный, без мистического запугивания."
#     )
#     user_payload = {
#         "dream_text": normalized_dream_text,
#         "language": payload.language,
#         "timezone": payload.timezone,
#     }
#     request_body = {
#         "contents": [
#             {
#                 "role": "user",
#                 "parts": [
#                     {
#                         "text": f"{prompt}\n\nДанные пользователя:\n{json.dumps(user_payload, ensure_ascii=False)}"
#                     }
#                 ],
#             }
#         ],
#         "generationConfig": {
#             "temperature": 0.6,
#             "responseMimeType": "application/json",
#         },
#     }

#     def call_model(active_model_name: str) -> DreamInterpretResponse:
#         url = (
#             "https://generativelanguage.googleapis.com/v1beta/models/"
#             f"{active_model_name}:generateContent"
#         )
#         headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}

#         response = requests.post(url, json=request_body, headers=headers, timeout=15)
#         try:
#             response.raise_for_status()
#         except requests.HTTPError:
#             logger.error(
#                 "Gemini HTTP error model=%s status=%s body=%s",
#                 active_model_name,
#                 response.status_code,
#                 response.text[:500],
#             )
#             raise

#         body = response.json()
#         text = (
#             body.get("candidates", [{}])[0]
#             .get("content", {})
#             .get("parts", [{}])[0]
#             .get("text", "")
#             .strip()
#         )
#         if not text:
#             raise ValueError("Gemini returned an empty response")

#         parsed = json.loads(text)
#         interpreted = DreamInterpretResponse(**parsed)
#         interpreted.fallback = False
#         interpreted.provider = f"gemini:{active_model_name}"
#         dream_interpret_cache[cache_key] = (time.time(), interpreted.model_copy(deep=True))
#         return interpreted

#     models_to_try: List[str] = []
#     for candidate in (model_name, fallback_model, hard_fallback_model):
#         if candidate and candidate not in models_to_try:
#             models_to_try.append(candidate)

#     last_error: Optional[Exception] = None
#     for idx, candidate_model in enumerate(models_to_try):
#         try:
#             if idx > 0:
#                 logger.warning("Retrying Gemini with fallback model %s", candidate_model)
#             return call_model(candidate_model)
#         except requests.HTTPError as exc:
#             status_code = exc.response.status_code if exc.response is not None else None
#             last_error = exc
#             if status_code in (400, 404):
#                 continue
#             if status_code == 429:
#                 # Quota/rate limit means extra model calls are likely wasteful right now.
#                 raise
#             raise
#         except (ValueError, json.JSONDecodeError, ValidationError) as exc:
#             last_error = exc
#             continue

#     if last_error:
#         raise last_error
#     raise ValueError("No Gemini models available to process request")

# Add your routes to the router instead of directly to app
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

        if status_code == 429:
            logger.warning("Gemini quota/rate limit reached, returning fallback")
            return build_fallback_response()

        logger.exception("Gemini HTTP error, returning fallback")
        return build_fallback_response()

    except (requests.RequestException, ValueError, KeyError, ValidationError, json.JSONDecodeError) as exc:
        logger.exception("Gemini interpretation failed, returning fallback: %s", exc)
        return build_fallback_response()

# @api_router.post("/status", response_model=StatusCheck)
# async def create_status_check(input: StatusCheckCreate):
#     status_dict = input.dict()
#     status_obj = StatusCheck(**status_dict)
#     _ = await db.status_checks.insert_one(status_obj.dict())
#     return status_obj

# @api_router.get("/status", response_model=List[StatusCheck])
# async def get_status_checks():
#     status_checks = await db.status_checks.find().to_list(1000)
#     return [StatusCheck(**status_check) for status_check in status_checks]


# @api_router.post("/dreams/interpret", response_model=DreamInterpretResponse)
# async def interpret_dream(input: DreamInterpretRequest):
#     dream_text = input.dream_text.strip()
#     if not dream_text:
#         raise HTTPException(status_code=400, detail="dream_text must not be empty")
#
#     try:
#         return gemini_interpret_dream(input)
#     except requests.HTTPError as exc:
#         status_code = exc.response.status_code if exc.response is not None else None
#         if status_code == 429:
#             logger.warning("Gemini quota/rate limit reached, returning safe fallback")
#             return build_fallback_response()
#         logger.exception("Gemini HTTP error: %s", exc)
#         return build_fallback_response()
#     except (requests.RequestException, ValueError, KeyError, ValidationError, json.JSONDecodeError) as exc:
#         logger.exception("Gemini interpretation failed: %s", exc)
#         return build_fallback_response()

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
