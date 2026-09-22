"""Tarot spread chat via a dedicated Mistral agent (Conversations API).

Dream interpretation stays on MISTRAL_AGENT_ID + /api/dreams/interpret.
This module uses MISTRAL_TAROT_AGENT_ID only.
"""

from __future__ import annotations

import logging
import os
import threading
import time
import uuid
from typing import Any, Dict, List, Optional

import requests
from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter()

DEBUG_AI_ERRORS = os.getenv("DEBUG_AI_ERRORS", "false").lower() == "true"
MISTRAL_REQUEST_TIMEOUT_SECONDS = 60
MISTRAL_MAX_ATTEMPTS = 3
RETRYABLE_HTTP_STATUSES = {408, 409, 429, 500, 502, 503, 504}

MAX_FOLLOWUPS = 2
MAX_QUESTION_LENGTH = 800
MAX_MESSAGE_LENGTH = 800
MAX_CARDS = 8
FALLBACK_CONVERSATION_PREFIX = "local-fallback-"

_lock = threading.Lock()
_followups_used: Dict[str, int] = {}
_aliases: Dict[str, str] = {}

logger.info(
    "Tarot chat config | api_key_present=%s | tarot_agent_id_present=%s | tarot_agent_id_prefix=%s",
    bool(os.getenv("MISTRAL_API_KEY")),
    bool(os.getenv("MISTRAL_TAROT_AGENT_ID")),
    (os.getenv("MISTRAL_TAROT_AGENT_ID") or "")[:10],
)


class TarotChatCardIn(BaseModel):
    position_id: str = Field(min_length=1, max_length=80)
    position_label_ru: str = Field(min_length=1, max_length=80)
    card_id: str = Field(min_length=1, max_length=80)
    card_name: str = Field(min_length=1, max_length=120)
    short: str = Field(default="", max_length=600)
    detailed: str = Field(default="", max_length=2500)
    reversed: bool = False


class TarotChatStartRequest(BaseModel):
    question: str = Field(default="", max_length=MAX_QUESTION_LENGTH)
    topic: Optional[str] = Field(default=None, max_length=80)
    spread_id: str = Field(min_length=1, max_length=80)
    spread_title_ru: str = Field(min_length=1, max_length=120)
    cards: List[TarotChatCardIn] = Field(min_length=1, max_length=MAX_CARDS)
    language: str = Field(default="ru", max_length=8)


class TarotChatFollowupRequest(BaseModel):
    conversation_id: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)


class TarotChatResponse(BaseModel):
    conversation_id: str
    reply: str
    followups_used: int
    followups_remaining: int
    provider: str = "mistral"
    fallback: bool = False


def _canonical_locked(conversation_id: str) -> str:
    cid = conversation_id
    seen: set[str] = set()
    while cid in _aliases and cid not in seen:
        seen.add(cid)
        cid = _aliases[cid]
    return cid


def _get_followups_used(conversation_id: str) -> int:
    with _lock:
        cid = _canonical_locked(conversation_id)
        if cid in _followups_used:
            return _followups_used[cid]
        return _followups_used.get(conversation_id, 0)


def _set_followups_used(old_id: str, new_id: str, used: int) -> None:
    with _lock:
        _followups_used[new_id] = used
        _followups_used[old_id] = used
        if old_id != new_id:
            _aliases[old_id] = new_id


def _extract_chunk_text(chunk: Any) -> str:
    if isinstance(chunk, str):
        return chunk
    if isinstance(chunk, dict):
        text = chunk.get("text")
        return text if isinstance(text, str) else ""
    text = getattr(chunk, "text", None)
    return text if isinstance(text, str) else ""


def extract_assistant_reply(body: dict) -> str:
    outputs = body.get("outputs")
    if not isinstance(outputs, list):
        outputs = []

    parts: List[str] = []
    for entry in outputs:
        if not isinstance(entry, dict):
            continue
        entry_type = entry.get("type")
        if entry_type and entry_type not in ("message.output", "message"):
            continue
        content = entry.get("content")
        if isinstance(content, str):
            if content.strip():
                parts.append(content.strip())
            continue
        if isinstance(content, list):
            joined = "".join(_extract_chunk_text(chunk) for chunk in content).strip()
            if joined:
                parts.append(joined)

    if parts:
        return "\n\n".join(parts).strip()

    # Fallback: some payloads nest the message under choices like chat completions.
    choices = body.get("choices")
    if isinstance(choices, list) and choices:
        message = choices[0].get("message") if isinstance(choices[0], dict) else None
        if isinstance(message, dict):
            content = message.get("content")
            if isinstance(content, str) and content.strip():
                return content.strip()

    raise ValueError("Mistral conversation response had no assistant text")


def build_start_user_message(payload: TarotChatStartRequest) -> str:
    lines = [
        f"Расклад: {payload.spread_title_ru.strip()} ({payload.spread_id.strip()})",
        "",
        "Карты:",
    ]
    for index, card in enumerate(payload.cards, start=1):
        orientation = "перевёрнутая" if card.reversed else "прямая"
        lines.append(
            f"{index}. {card.position_label_ru.strip()} — {card.card_name.strip()} ({orientation})"
        )
        short = card.short.strip()
        detailed = card.detailed.strip()
        if short:
            lines.append(f"   Кратко: {short}")
        if detailed:
            lines.append(f"   Подробно: {detailed}")

    topic = (payload.topic or "").strip()
    question = payload.question.strip()
    if question:
        focus = f"Вопрос: {question}"
        instruction = (
            "Истолкуй этот расклад в контексте вопроса. "
            "Пиши по-русски, живым текстом, без JSON. "
            "Обращайся к человеку на «вы», гендерно нейтрально: "
            "«вы создали», «вы готовы», «вы могли»."
        )
    elif topic:
        focus = f"Вопрос: не указан — ориентируйся на сферу «{topic}»."
        instruction = (
            "Истолкуй этот расклад в контексте выбранной сферы. "
            "Пиши по-русски, живым текстом, без JSON. "
            "Обращайся к человеку на «вы», гендерно нейтрально: "
            "«вы создали», «вы готовы», «вы могли»."
        )
    else:
        focus = "Вопрос: не указан."
        instruction = (
            "Истолкуй этот расклад целиком. "
            "Пиши по-русски, живым текстом, без JSON. "
            "Обращайся к человеку на «вы», гендерно нейтрально: "
            "«вы создали», «вы готовы», «вы могли»."
        )

    lines.extend(
        [
            "",
            f"Сфера: {topic if topic else 'не указана'}",
            focus,
            "",
            instruction,
        ]
    )
    return "\n".join(lines)


def build_fallback_reply(payload: Optional[TarotChatStartRequest]) -> str:
    if payload is None:
        return (
            "Карты уже сказали главное — сейчас важнее не гнаться за ответом, "
            "а заметить, какое чувство откликается сильнее всего. "
            "Вернитесь к позициям расклада и спросите себя, где вы уже это проживаете."
        )

    card_lines = []
    for card in payload.cards:
        snippet = card.short.strip() or card.card_name
        orientation = "перевёрнутая" if card.reversed else "прямая"
        card_lines.append(
            f"{card.position_label_ru} — {card.card_name} ({orientation}): {snippet}"
        )

    joined = " ".join(card_lines)
    question = payload.question.strip()
    topic = (payload.topic or "").strip()
    focus = question or (f"сферу «{topic}»" if topic else "этот расклад")
    return (
        f"Пока живой диалог с толкователем недоступен, вот нить расклада «{payload.spread_title_ru}» "
        f"для {focus}. {joined} "
        "Смотри не на предсказание, а на то, какая из этих тем сейчас ближе телу и сердцу."
    )


def _mistral_headers(api_key: str) -> dict:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def call_conversations_once(api_key: str, url: str, request_body: dict) -> dict:
    response = requests.post(
        url,
        headers=_mistral_headers(api_key),
        json=request_body,
        timeout=MISTRAL_REQUEST_TIMEOUT_SECONDS,
    )
    if not response.ok:
        logger.error(
            "Mistral conversations HTTP error | status=%s | body=%s",
            response.status_code,
            response.text[:3000],
        )
        response.raise_for_status()
    body = response.json()
    if not isinstance(body, dict):
        raise ValueError("Mistral conversations response was not an object")
    return body


def call_conversations_with_retries(api_key: str, url: str, request_body: dict) -> dict:
    last_error: Optional[Exception] = None
    for attempt_index in range(MISTRAL_MAX_ATTEMPTS):
        try:
            logger.info(
                "Calling Mistral Conversations | attempt=%s/%s | url=%s",
                attempt_index + 1,
                MISTRAL_MAX_ATTEMPTS,
                url,
            )
            return call_conversations_once(api_key, url, request_body)
        except requests.HTTPError as exc:
            last_error = exc
            status = exc.response.status_code if exc.response is not None else None
            if status not in RETRYABLE_HTTP_STATUSES:
                raise
        except (requests.RequestException, ValueError, TypeError) as exc:
            last_error = exc

        if attempt_index < MISTRAL_MAX_ATTEMPTS - 1:
            time.sleep(1.2 * (attempt_index + 1))

    if last_error:
        raise last_error
    raise RuntimeError("Mistral conversations call failed")


def _raise_or_fallback(
    exc: Exception,
    payload: Optional[TarotChatStartRequest],
    conversation_id: Optional[str],
    used: int,
) -> TarotChatResponse:
    logger.exception("Tarot chat failed: %s", exc)
    if DEBUG_AI_ERRORS:
        if isinstance(exc, requests.HTTPError) and exc.response is not None:
            raise HTTPException(
                status_code=500,
                detail={
                    "type": "mistral_http_error",
                    "status_code": exc.response.status_code,
                    "body": exc.response.text[:3000],
                },
            )
        raise HTTPException(
            status_code=500,
            detail={"type": exc.__class__.__name__, "message": str(exc)[:1000]},
        )

    cid = conversation_id or f"{FALLBACK_CONVERSATION_PREFIX}{uuid.uuid4().hex[:16]}"
    _set_followups_used(cid, cid, used)
    remaining = max(0, MAX_FOLLOWUPS - used)
    return TarotChatResponse(
        conversation_id=cid,
        reply=build_fallback_reply(payload),
        followups_used=used,
        followups_remaining=remaining,
        provider="fallback",
        fallback=True,
    )


def start_tarot_chat_sync(payload: TarotChatStartRequest) -> TarotChatResponse:
    api_key = os.getenv("MISTRAL_API_KEY") or ""
    agent_id = os.getenv("MISTRAL_TAROT_AGENT_ID") or ""
    user_message = build_start_user_message(payload)

    if not api_key or not agent_id:
        logger.warning(
            "Tarot chat missing config | api_key=%s | agent_id=%s",
            bool(api_key),
            bool(agent_id),
        )
        cid = f"{FALLBACK_CONVERSATION_PREFIX}{uuid.uuid4().hex[:16]}"
        _set_followups_used(cid, cid, 0)
        return TarotChatResponse(
            conversation_id=cid,
            reply=build_fallback_reply(payload),
            followups_used=0,
            followups_remaining=MAX_FOLLOWUPS,
            provider="fallback",
            fallback=True,
        )

    request_body = {
        "agent_id": agent_id,
        "inputs": user_message,
        "stream": False,
    }

    try:
        body = call_conversations_with_retries(
            api_key,
            "https://api.mistral.ai/v1/conversations",
            request_body,
        )
        conversation_id = str(body.get("conversation_id") or "").strip()
        if not conversation_id:
            raise ValueError("Mistral conversation_id is missing")
        reply = extract_assistant_reply(body)
        _set_followups_used(conversation_id, conversation_id, 0)
        return TarotChatResponse(
            conversation_id=conversation_id,
            reply=reply,
            followups_used=0,
            followups_remaining=MAX_FOLLOWUPS,
            provider="mistral",
            fallback=False,
        )
    except Exception as exc:
        return _raise_or_fallback(exc, payload, None, 0)


def followup_tarot_chat_sync(payload: TarotChatFollowupRequest) -> TarotChatResponse:
    conversation_id = payload.conversation_id.strip()
    used = _get_followups_used(conversation_id)
    if used >= MAX_FOLLOWUPS:
        raise HTTPException(
            status_code=403,
            detail="Лимит уточнений для этого расклада исчерпан.",
        )

    if conversation_id.startswith(FALLBACK_CONVERSATION_PREFIX):
        next_used = used + 1
        _set_followups_used(conversation_id, conversation_id, next_used)
        return TarotChatResponse(
            conversation_id=conversation_id,
            reply=(
                "Пока живой агент недоступен, опирайтесь на сами карты: "
                "какая позиция сильнее всего откликается на ваш новый вопрос? "
                "Ответ уже есть в том, что вы замечаете."
            ),
            followups_used=next_used,
            followups_remaining=max(0, MAX_FOLLOWUPS - next_used),
            provider="fallback",
            fallback=True,
        )

    api_key = os.getenv("MISTRAL_API_KEY") or ""
    agent_id = os.getenv("MISTRAL_TAROT_AGENT_ID") or ""
    if not api_key or not agent_id:
        return _raise_or_fallback(
            RuntimeError("Mistral tarot agent is not configured"),
            None,
            conversation_id,
            used,
        )

    request_body = {
        "inputs": payload.message.strip(),
        "stream": False,
    }
    url = f"https://api.mistral.ai/v1/conversations/{conversation_id}"

    try:
        body = call_conversations_with_retries(api_key, url, request_body)
        new_id = str(body.get("conversation_id") or conversation_id).strip()
        reply = extract_assistant_reply(body)
        next_used = used + 1
        _set_followups_used(conversation_id, new_id or conversation_id, next_used)
        return TarotChatResponse(
            conversation_id=new_id or conversation_id,
            reply=reply,
            followups_used=next_used,
            followups_remaining=max(0, MAX_FOLLOWUPS - next_used),
            provider="mistral",
            fallback=False,
        )
    except HTTPException:
        raise
    except Exception as exc:
        return _raise_or_fallback(exc, None, conversation_id, used)


@router.post("/tarot/chat/start", response_model=TarotChatResponse)
async def start_tarot_chat(payload: TarotChatStartRequest):
    question = payload.question.strip()
    topic = (payload.topic or "").strip()
    if not question and not topic:
        raise HTTPException(
            status_code=400,
            detail="Выберите сферу или введите вопрос к раскладу.",
        )
    try:
        return await run_in_threadpool(start_tarot_chat_sync, payload)
    except HTTPException:
        raise
    except Exception as exc:
        return _raise_or_fallback(exc, payload, None, 0)


@router.post("/tarot/chat/followup", response_model=TarotChatResponse)
async def followup_tarot_chat(payload: TarotChatFollowupRequest):
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Введите уточнение.")
    try:
        return await run_in_threadpool(followup_tarot_chat_sync, payload)
    except HTTPException:
        raise
    except Exception as exc:
        return _raise_or_fallback(exc, None, payload.conversation_id, 0)
