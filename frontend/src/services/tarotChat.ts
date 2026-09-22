import { apiBaseUrl, ApiError } from "./api";

export const TAROT_CHAT_MAX_FOLLOWUPS = 2;
export const TAROT_CHAT_QUESTION_MAX_LENGTH = 500;
/** Free / guest / non‑Pro: how many new AI tarot chats can be started. */
export const FREE_TAROT_INTERPRET_LIMIT = 5;

export const TAROT_CHAT_TOPICS = [
  "Ситуация",
  "Любовь",
  "Карьера",
  "Отношения",
  "Финансы",
] as const;

export type TarotChatTopic = (typeof TAROT_CHAT_TOPICS)[number];

export type TarotChatCardPayload = {
  positionId: string;
  positionLabelRu: string;
  cardId: string;
  cardName: string;
  short: string;
  detailed: string;
  reversed?: boolean;
};

export type TarotChatStartRequest = {
  /** Optional if `topic` is set. */
  question?: string;
  topic?: string;
  spreadId: string;
  spreadTitleRu: string;
  cards: TarotChatCardPayload[];
  language?: string;
};

export type TarotChatFollowupRequest = {
  conversationId: string;
  message: string;
};

export type TarotChatResponse = {
  conversationId: string;
  reply: string;
  followupsUsed: number;
  followupsRemaining: number;
  provider: string;
  fallback: boolean;
};

const SPREAD_DEFAULT_TOPIC: Record<string, TarotChatTopic> = {
  "love-three": "Любовь",
  "career-growth": "Карьера",
  "where-money": "Финансы",
  thoughts: "Отношения",
  "three-situation": "Ситуация",
  choice: "Ситуация",
  "yes-no": "Ситуация",
  "problem-solution": "Ситуация",
  "blind-spot": "Ситуация",
  "relationship-cross": "Любовь",
  purpose: "Карьера",
};

export function defaultTopicForSpread(spreadId?: string): TarotChatTopic | undefined {
  if (!spreadId) return undefined;
  return SPREAD_DEFAULT_TOPIC[spreadId];
}

export type TarotInterpretQuota = {
  unlimited: boolean;
  used: number;
  remaining: number;
  limit: number;
};

/** Counts finished AI chat starts (items that already have a conversation). */
export function countUsedTarotInterprets(
  items: { type?: string; tarotChat?: { conversationId?: string } | null }[],
): number {
  return items.filter(
    (item) =>
      item.type === "tarot" &&
      typeof item.tarotChat?.conversationId === "string" &&
      item.tarotChat.conversationId.length > 0,
  ).length;
}

export function getTarotInterpretQuota(input: {
  isPro: boolean;
  items: { type?: string; tarotChat?: { conversationId?: string } | null }[];
}): TarotInterpretQuota {
  const used = countUsedTarotInterprets(input.items);
  if (input.isPro) {
    return {
      unlimited: true,
      used,
      remaining: FREE_TAROT_INTERPRET_LIMIT,
      limit: FREE_TAROT_INTERPRET_LIMIT,
    };
  }
  return {
    unlimited: false,
    used,
    remaining: Math.max(0, FREE_TAROT_INTERPRET_LIMIT - used),
    limit: FREE_TAROT_INTERPRET_LIMIT,
  };
}

/** True if this spread may open/start AI chat without consuming a new free slot. */
export function canOpenTarotInterpret(input: {
  isPro: boolean;
  items: { type?: string; tarotChat?: { conversationId?: string } | null }[];
  chatAlreadyStarted: boolean;
}): boolean {
  if (input.chatAlreadyStarted || input.isPro) return true;
  return getTarotInterpretQuota(input).remaining > 0;
}

function toStartPayload(input: TarotChatStartRequest) {
  return {
    question: (input.question ?? "")
      .trim()
      .slice(0, TAROT_CHAT_QUESTION_MAX_LENGTH),
    topic: input.topic?.trim() || undefined,
    spread_id: input.spreadId,
    spread_title_ru: input.spreadTitleRu,
    language: input.language ?? "ru",
    cards: input.cards.map((card) => ({
      position_id: card.positionId,
      position_label_ru: card.positionLabelRu,
      card_id: card.cardId,
      card_name: card.cardName,
      short: card.short,
      detailed: card.detailed,
      reversed: card.reversed === true,
    })),
  };
}

function isValidResponse(value: unknown): value is {
  conversation_id: string;
  reply: string;
  followups_used: number;
  followups_remaining: number;
  provider: string;
  fallback: boolean;
} {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.conversation_id === "string" &&
    v.conversation_id.length > 0 &&
    typeof v.reply === "string" &&
    typeof v.followups_used === "number" &&
    typeof v.followups_remaining === "number" &&
    typeof v.provider === "string" &&
    typeof v.fallback === "boolean"
  );
}

function normalize(raw: {
  conversation_id: string;
  reply: string;
  followups_used: number;
  followups_remaining: number;
  provider: string;
  fallback: boolean;
}): TarotChatResponse {
  return {
    conversationId: raw.conversation_id,
    reply: raw.reply,
    followupsUsed: raw.followups_used,
    followupsRemaining: raw.followups_remaining,
    provider: raw.provider,
    fallback: raw.fallback,
  };
}

async function postTarotChat(path: string, body: unknown): Promise<TarotChatResponse> {
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    let detail = "";
    if (json && typeof json === "object" && "detail" in json) {
      const d = (json as { detail: unknown }).detail;
      detail = typeof d === "string" ? d : JSON.stringify(d);
    }
    throw new ApiError(detail || `Tarot chat failed (${res.status})`, res.status);
  }

  if (!isValidResponse(json)) {
    throw new Error("Tarot chat response has invalid shape");
  }
  return normalize(json);
}

export async function startTarotChat(
  input: TarotChatStartRequest,
): Promise<TarotChatResponse> {
  const payload = toStartPayload(input);
  if (!payload.question && !payload.topic) {
    throw new Error("Выберите сферу или введите вопрос.");
  }
  if (!payload.cards.length) {
    throw new Error("В раскладе нет карт.");
  }
  return postTarotChat("/api/tarot/chat/start", payload);
}

export async function followupTarotChat(
  input: TarotChatFollowupRequest,
): Promise<TarotChatResponse> {
  const message = input.message.trim().slice(0, TAROT_CHAT_QUESTION_MAX_LENGTH);
  if (!message) {
    throw new Error("Введите уточнение.");
  }
  return postTarotChat("/api/tarot/chat/followup", {
    conversation_id: input.conversationId,
    message,
  });
}
