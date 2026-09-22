import type { HistoryItem } from "../context/HistoryContext";
import { apiFetch } from "./api";

export async function fetchRemoteHistory(token: string): Promise<HistoryItem[]> {
  const data = await apiFetch<{ items: HistoryItem[] }>("/api/me/history", {
    token,
    timeoutMs: 20_000,
    retries: 1,
  });
  return Array.isArray(data.items) ? data.items : [];
}

export async function saveRemoteHistory(
  token: string,
  items: HistoryItem[],
): Promise<HistoryItem[]> {
  const data = await apiFetch<{ items: HistoryItem[] }>("/api/me/history", {
    method: "PUT",
    token,
    body: JSON.stringify({ items }),
  });
  return Array.isArray(data.items) ? data.items : items;
}

export async function mergeRemoteHistory(
  token: string,
  items: HistoryItem[],
): Promise<HistoryItem[]> {
  const data = await apiFetch<{ items: HistoryItem[] }>("/api/me/history/merge", {
    method: "POST",
    token,
    body: JSON.stringify({ items }),
  });
  return Array.isArray(data.items) ? data.items : items;
}
