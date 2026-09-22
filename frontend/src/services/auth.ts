import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { apiBaseUrl, apiFetch } from "./api";

WebBrowser.maybeCompleteAuthSession();

export type AuthProvider = "google" | "email";

export type AuthUser = {
  id: string;
  email: string | null;
  name: string;
  picture: string | null;
  is_pro: boolean;
  notifications_enabled: boolean;
  auth_provider: AuthProvider;
};

export type AuthSession = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

function queryValue(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | undefined {
  const value = params?.[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

export function parseAuthRedirect(url: string): { code?: string; error?: string } {
  const parsed = Linking.parse(url);
  return {
    code: queryValue(parsed.queryParams, "code"),
    error: queryValue(parsed.queryParams, "error"),
  };
}

export async function fetchMe(token: string): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/me", { token });
}

export async function patchMe(
  token: string,
  body: { name?: string; notifications_enabled?: boolean },
): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/me", {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

const AUTH_TIMEOUT_MS = 20_000;

export async function exchangeAuthCode(code: string): Promise<AuthSession> {
  return apiFetch<AuthSession>("/api/auth/google/exchange", {
    method: "POST",
    body: JSON.stringify({ code }),
    timeoutMs: AUTH_TIMEOUT_MS,
    retries: 1,
  });
}

export async function startGoogleSignIn(): Promise<AuthSession> {
  const redirectUri = Linking.createURL("auth");
  const startUrl = `${apiBaseUrl()}/api/auth/google/start?redirect_uri=${encodeURIComponent(redirectUri)}`;
  const result = await WebBrowser.openAuthSessionAsync(startUrl, redirectUri);

  if (result.type === "cancel" || result.type === "dismiss") {
    const cancel = new Error("cancelled");
    cancel.name = "AuthCancelled";
    throw cancel;
  }
  if (result.type !== "success" || !("url" in result) || !result.url) {
    throw new Error("Не удалось открыть окно Google");
  }

  const { code, error } = parseAuthRedirect(result.url);
  if (error === "cancelled") {
    const cancel = new Error("cancelled");
    cancel.name = "AuthCancelled";
    throw cancel;
  }
  if (error) {
    throw new Error("Не удалось войти через Google");
  }
  if (!code) {
    throw new Error("Google не вернул код авторизации");
  }
  return exchangeAuthCode(code);
}

export async function registerWithEmail(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthSession> {
  return apiFetch<AuthSession>("/api/auth/email/register", {
    method: "POST",
    body: JSON.stringify(input),
    timeoutMs: AUTH_TIMEOUT_MS,
  });
}

export async function loginWithEmail(input: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  return apiFetch<AuthSession>("/api/auth/email/login", {
    method: "POST",
    body: JSON.stringify(input),
    timeoutMs: AUTH_TIMEOUT_MS,
    retries: 1,
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await apiFetch("/api/auth/email/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
    timeoutMs: AUTH_TIMEOUT_MS,
    retries: 1,
  });
}

export async function resetPasswordWithCode(input: {
  email: string;
  code: string;
  password: string;
}): Promise<AuthSession> {
  return apiFetch<AuthSession>("/api/auth/email/reset", {
    method: "POST",
    body: JSON.stringify(input),
    timeoutMs: AUTH_TIMEOUT_MS,
  });
}
