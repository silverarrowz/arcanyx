import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TarotSpread } from "../data/tarotSpreads";
import { apiFetch } from "./api";

const CACHE_KEY = "@mystix_tarot_spreads_catalog_v1";

type TarotSpreadsResponse = {
  items: TarotSpread[];
};

function validSpreads(value: unknown): TarotSpread[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is TarotSpread => {
    if (!item || typeof item !== "object") return false;
    const spread = item as Partial<TarotSpread>;
    return Boolean(
      spread.id &&
        spread.titleRu &&
        spread.subtitleRu &&
        Array.isArray(spread.positions) &&
        spread.positions.length >= 1 &&
        spread.positions.length <= 5 &&
        spread.drawCount === spread.positions.length,
    );
  });
}

export async function readCachedTarotSpreads(): Promise<TarotSpread[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const items = validSpreads(JSON.parse(raw));
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

export async function fetchTarotSpreads(): Promise<TarotSpread[]> {
  const response = await apiFetch<TarotSpreadsResponse>(
    `/api/tarot-spreads?_=${Date.now()}`,
    {
      timeoutMs: 12000,
      retries: 1,
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    },
  );
  const items = validSpreads(response.items);
  if (items.length === 0) {
    throw new Error("Каталог раскладов пуст");
  }
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(items)).catch(() => {});
  return items;
}
