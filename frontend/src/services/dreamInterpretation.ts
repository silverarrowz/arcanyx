/** Must match backend `DreamInterpretRequest.dream_text` (Pydantic `max_length`). */
export const DREAM_TEXT_MAX_LENGTH = 3000;

export type DreamInterpretRequest = {
  dreamText: string;
  language?: string;
  timezone?: string;
};

export type DreamInterpretResponse = {
  title: string;
  interpretation: string;
  symbols: string[];
  advice: string;
  provider: string;
  fallback: boolean;
};

const DEFAULT_API_BASE_URL = "https://mystix-production.up.railway.app";

function apiBaseUrl(): string {
  const raw = process.env.VITE_API_URL?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/+$/, "") : DEFAULT_API_BASE_URL;
}

function toPayload(input: DreamInterpretRequest) {
  const dream_text = input.dreamText.trim().slice(0, DREAM_TEXT_MAX_LENGTH);
  return {
    dream_text,
    language: input.language ?? "ru",
    timezone: input.timezone,
  };
}

function isValidResponse(value: unknown): value is DreamInterpretResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<DreamInterpretResponse>;
  return (
    typeof v.title === "string" &&
    typeof v.interpretation === "string" &&
    Array.isArray(v.symbols) &&
    v.symbols.every((s) => typeof s === "string") &&
    typeof v.advice === "string" &&
    typeof v.provider === "string" &&
    typeof v.fallback === "boolean"
  );
}

function formatInterpretErrorBody(body: unknown): string {
  if (body === null || body === undefined) return "";
  if (typeof body === "object" && body !== null && "detail" in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    try {
      return JSON.stringify(d);
    } catch {
      return String(d);
    }
  }
  if (typeof body === "string") return body;
  try {
    return JSON.stringify(body);
  } catch {
    return "";
  }
}

export async function interpretDream(
  input: DreamInterpretRequest,
): Promise<DreamInterpretResponse> {
  const payload = toPayload(input);
  if (!payload.dream_text) {
    throw new Error("Введите описание сна.");
  }

  const res = await fetch(`${apiBaseUrl()}/api/dreams/interpret`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = formatInterpretErrorBody(await res.json());
    } catch {
      try {
        detail = (await res.text()).slice(0, 500);
      } catch {
        detail = "";
      }
    }
    const suffix = detail ? `: ${detail}` : "";
    throw new Error(`Dream interpretation failed (${res.status})${suffix}`);
  }

  const json = (await res.json()) as unknown;
  if (!isValidResponse(json)) {
    throw new Error("Dream interpretation response has invalid shape");
  }
  return json;
}
