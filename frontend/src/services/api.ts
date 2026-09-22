/** Shared API helpers. Backend base URL has no trailing slash. */

export function apiBaseUrl(): string {
  const raw = (
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.VITE_API_URL ??
    ""
  ).trim();

  if (!raw) {
    throw new Error(
      "API URL is not configured. Set EXPO_PUBLIC_API_BASE_URL to the Timeweb backend.",
    );
  }

  return raw.replace(/\/+$/, "");
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const NETWORK_ERROR_MESSAGE =
  "Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз.";

type ApiFetchOptions = RequestInit & {
  token?: string | null;
  timeoutMs?: number;
  retries?: number;
};

function readDetail(body: unknown): string {
  if (!body || typeof body !== "object" || !("detail" in body)) return "";
  const detail = (body as { detail: unknown }).detail;
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

function errorText(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name} ${err.message}`;
  }
  return String(err);
}

export function isTransientNetworkError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return [408, 425, 429, 502, 503, 504].includes(err.status);
  }
  const text = errorText(err);
  return /abort|cancel|timeout|timed out|network request failed|fetch failed|failed to connect|could not connect|internet connection|offline|socket|timedout/i.test(
    text,
  );
}

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) {
    if (isTransientNetworkError(err) && !err.message.trim()) {
      return new ApiError(NETWORK_ERROR_MESSAGE, err.status || 408);
    }
    if (isTransientNetworkError(err) && /fetch failed|cancel|abort/i.test(err.message)) {
      return new ApiError(NETWORK_ERROR_MESSAGE, err.status || 408);
    }
    return err;
  }
  if (isTransientNetworkError(err)) {
    return new ApiError(NETWORK_ERROR_MESSAGE, 408);
  }
  if (err instanceof Error && err.message) {
    return new ApiError(err.message, 0);
  }
  return new ApiError(NETWORK_ERROR_MESSAGE, 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiFetchOnce<T>(path: string, options: ApiFetchOptions): Promise<T> {
  const {
    token,
    headers: initHeaders,
    signal: userSignal,
    timeoutMs = 15000,
    retries: _retries,
    ...rest
  } = options;
  const headers = new Headers(initHeaders);
  if (!headers.has("Content-Type") && rest.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Do not AbortController-timeout on iOS: Expo's fetch maps abort() to
  // FetchRequestCanceledException and can cancel a request that already succeeded.
  const fetchPromise = fetch(`${apiBaseUrl()}${path}`, {
    ...rest,
    signal: userSignal,
    headers,
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ApiError(NETWORK_ERROR_MESSAGE, 408));
    }, timeoutMs);
  });

  let res: Response;
  try {
    res = await Promise.race([fetchPromise, timeoutPromise]);
  } catch (err) {
    throw toApiError(err);
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = readDetail(await res.json());
    } catch {
      try {
        detail = (await res.text()).slice(0, 400);
      } catch {
        detail = "";
      }
    }
    throw new ApiError(detail || `Запрос не удался (${res.status})`, res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const retries = options.retries ?? (method === "GET" ? 1 : 0);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await apiFetchOnce<T>(path, options);
    } catch (err) {
      lastError = err;
      const canRetry = isTransientNetworkError(err) && attempt < retries;
      if (!canRetry) {
        throw toApiError(err);
      }
      await sleep(400 * (attempt + 1));
    }
  }

  throw toApiError(lastError);
}
