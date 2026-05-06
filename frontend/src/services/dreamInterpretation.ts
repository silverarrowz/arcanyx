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
  return {
    dream_text: input.dreamText,
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

export async function interpretDream(
  input: DreamInterpretRequest,
): Promise<DreamInterpretResponse> {
  const res = await fetch(`${apiBaseUrl()}/api/dreams/interpret`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(toPayload(input)),
  });

  if (!res.ok) {
    throw new Error(`Dream interpretation failed with status ${res.status}`);
  }

  const json = (await res.json()) as unknown;
  if (!isValidResponse(json)) {
    throw new Error("Dream interpretation response has invalid shape");
  }
  return json;
}
