import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiFetch } from "./api";

export type SupportCategory =
  | "technical"
  | "account"
  | "content"
  | "idea"
  | "other";

export type SupportRequest = {
  category: SupportCategory;
  email: string;
  message: string;
};

export type SupportResponse = {
  id: string;
  status: "received";
};

export async function sendSupportRequest(
  request: SupportRequest,
  token?: string | null,
): Promise<SupportResponse> {
  const appVersion =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? undefined;

  return apiFetch<SupportResponse>("/api/support", {
    method: "POST",
    token,
    body: JSON.stringify({
      category: request.category,
      email: request.email.trim(),
      message: request.message.trim(),
      platform: Platform.OS,
      app_version: appVersion,
    }),
  });
}
