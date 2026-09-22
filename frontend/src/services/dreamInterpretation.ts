import { apiBaseUrl } from "./api";

/** Must match backend `DreamInterpretRequest.dream_text` (Pydantic `max_length`). */
export const DREAM_TEXT_MAX_LENGTH = 3000;

/** Must match backend `DreamIllustrationRequest.dream_text`. */
export const DREAM_ILLUSTRATION_TEXT_MAX_LENGTH = 1500;

const ILLUSTRATE_TIMEOUT_MS = 90_000;

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

export type DreamIllustrationImage = {
  url: string;
  width?: number | null;
  height?: number | null;
  content_type?: string | null;
};

export type DreamIllustrationResponse = {
  images: DreamIllustrationImage[];
  provider: string;
  model: string;
  seed?: number | null;
  has_nsfw_concepts?: boolean[] | null;
};

export type DreamImageStatus = "pending" | "ready" | "failed";

function isValidIllustrationResponse(
  value: unknown,
): value is DreamIllustrationResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<DreamIllustrationResponse>;
  return (
    Array.isArray(v.images) &&
    v.images.some(
      (image) =>
        image &&
        typeof image === "object" &&
        typeof (image as DreamIllustrationImage).url === "string" &&
        (image as DreamIllustrationImage).url.trim().length > 0,
    )
  );
}

export async function illustrateDream(dreamText: string): Promise<DreamIllustrationResponse> {
  const dream_text = dreamText.trim().slice(0, DREAM_ILLUSTRATION_TEXT_MAX_LENGTH);
  if (!dream_text) {
    throw new Error("Введите описание сна.");
  }

  const fetchPromise = fetch(`${apiBaseUrl()}/api/dreams/illustrate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dream_text,
      image_size: "square_hd",
      num_images: 1,
      output_format: "png",
    }),
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("Dream illustration timed out"));
    }, ILLUSTRATE_TIMEOUT_MS);
  });

  let res: Response;
  try {
    res = await Promise.race([fetchPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }

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
    throw new Error(`Dream illustration failed (${res.status})${suffix}`);
  }

  const json = (await res.json()) as unknown;
  if (!isValidIllustrationResponse(json)) {
    throw new Error("Dream illustration response has invalid shape");
  }
  return json;
}

export function startDreamIllustration(dreamText: string): Promise<string | null> {
  return illustrateDream(dreamText)
    .then((response) => {
      const url = response.images.find((image) => image.url?.trim())?.url?.trim();
      return url || null;
    })
    .catch((err) => {
      console.warn("Dream illustration failed", err);
      return null;
    });
}

export function applyDreamIllustration(
  dreamId: string,
  illustration: Promise<string | null>,
  updateItem: (
    id: string,
    patch: { dreamImageUrl?: string; dreamImageStatus?: DreamImageStatus },
  ) => void,
): void {
  illustration.then((url) => {
    if (url) {
      updateItem(dreamId, { dreamImageUrl: url, dreamImageStatus: "ready" });
      return;
    }
    updateItem(dreamId, { dreamImageStatus: "failed" });
  });
}
