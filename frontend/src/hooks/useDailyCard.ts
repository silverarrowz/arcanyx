import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TAROT_DECK, TarotCard } from "../data/tarotCards";

const STORAGE_KEY = "@daily_card_v1";

export type DailyCardData = {
  /** Local-day key in YYYY-MM-DD form. */
  date: string;
  cardId: string;
  intention?: string;
  /** ISO timestamp of when card was drawn — used for journal/share UX. */
  drawnAt: string;
};

export function todayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function resolveCard(cardId: string | undefined | null): TarotCard | null {
  if (!cardId) return null;
  return TAROT_DECK.find((c) => c.id === cardId) ?? null;
}

/**
 * Persists the current calendar day's tarot "Card of the Day" to AsyncStorage.
 * Returns null `card` until either:
 *   (a) loading finishes (loading flips false), or
 *   (b) a card has been drawn today (then `card` is non-null).
 *
 * Once a card is saved for today, calling saveCard again with a different
 * card id is rejected (returns the existing entry) — this enforces the
 * "one official daily card per day" rule from the UX spec.
 */
export function useDailyCard() {
  const [data, setData] = useState<DailyCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hydrate from AsyncStorage on mount, validating that the stored date
  // is still "today". If it's a previous day, treat as not-yet-drawn.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (!raw) {
          setData(null);
          return;
        }
        const parsed = JSON.parse(raw) as DailyCardData;
        if (parsed.date === todayKey()) {
          setData(parsed);
        } else {
          // Old entry — keep it stored (could be useful for streaks),
          // but UX-wise the user is allowed to draw a fresh card today.
          setData(null);
        }
      } catch (e) {
        if (!cancelled) setError("Не удалось загрузить карту дня");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveCard = useCallback(
    async (cardId: string, intention?: string): Promise<DailyCardData> => {
      // If already drawn today, return the existing entry untouched.
      const today = todayKey();
      if (data && data.date === today) return data;

      const payload: DailyCardData = {
        date: today,
        cardId,
        intention: intention?.trim() ? intention.trim() : undefined,
        drawnAt: new Date().toISOString(),
      };
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        setData(payload);
        setError(null);
        return payload;
      } catch (e) {
        setError("Не удалось сохранить карту дня");
        throw e;
      }
    },
    [data],
  );

  /** Dev/QA helper: clear today's daily card so the user can redraw. */
  const clearDailyCard = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setData(null);
      setError(null);
    } catch {
      // ignore
    }
  }, []);

  const card = resolveCard(data?.cardId);

  return {
    /** Resolved TarotCard for today, or null if not drawn. */
    card,
    /** Optional user-set intention from when they drew. */
    intention: data?.intention,
    /** True until the persisted state finishes hydrating. */
    loading,
    /** Latest error, cleared on next successful save. */
    error,
    /** True iff a daily card already exists for today. */
    hasDrawn: !!data,
    /** Persist a draw for today. Idempotent on the same calendar day. */
    saveCard,
    /** Reset for testing / fresh-day rollover. */
    clearDailyCard,
  };
}
