import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
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

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True only if the saved ritual belongs to the current local calendar day.
 * Uses both the stored `date` key and the local calendar day of `drawnAt` so a stale
 * entry cannot slip through if fields disagree.
 */
function isEntryValidForLocalToday(parsed: DailyCardData, now: Date = new Date()): boolean {
  const today = todayKey(now);
  const dateKey = typeof parsed.date === "string" ? parsed.date.trim() : "";
  if (!DATE_KEY_RE.test(dateKey) || dateKey !== today) return false;
  if (parsed.drawnAt) {
    const t = new Date(parsed.drawnAt);
    if (Number.isNaN(t.getTime())) return false;
    if (todayKey(t) !== today) return false;
  }
  return true;
}

function resolveCard(cardId: string | undefined | null): TarotCard | null {
  if (!cardId) return null;
  return TAROT_DECK.find((c) => c.id === cardId) ?? null;
}

type DailyCardContextValue = {
  refresh: () => Promise<void>;
  card: TarotCard | null;
  intention: string | undefined;
  loading: boolean;
  error: string | null;
  hasDrawn: boolean;
  saveCard: (cardId: string, intention?: string) => Promise<DailyCardData>;
  clearDailyCard: () => Promise<void>;
};

const DailyCardContext = createContext<DailyCardContextValue | undefined>(undefined);

export function DailyCardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DailyCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyStoredState = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const now = new Date();
      if (!raw) {
        setData(null);
        setError(null);
        return;
      }
      let parsed: DailyCardData;
      try {
        parsed = JSON.parse(raw) as DailyCardData;
      } catch {
        await AsyncStorage.removeItem(STORAGE_KEY);
        setData(null);
        setError(null);
        return;
      }

      if (!isEntryValidForLocalToday(parsed, now)) {
        await AsyncStorage.removeItem(STORAGE_KEY);
        setData(null);
        setError(null);
        return;
      }

      setData(parsed);
      setError(null);
    } catch {
      setError("Не удалось загрузить карту дня");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await applyStoredState();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyStoredState]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void applyStoredState();
    });
    return () => sub.remove();
  }, [applyStoredState]);

  useEffect(() => {
    const id = setInterval(() => {
      void applyStoredState();
    }, 30_000);
    return () => clearInterval(id);
  }, [applyStoredState]);

  const saveCard = useCallback(
    async (cardId: string, intention?: string): Promise<DailyCardData> => {
      if (data && isEntryValidForLocalToday(data)) {
        return data;
      }

      const payload: DailyCardData = {
        date: todayKey(),
        cardId,
        intention: intention?.trim() ? intention.trim() : undefined,
        drawnAt: new Date().toISOString(),
      };
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        setData(payload);
        setError(null);
        return payload;
      } catch {
        setError("Не удалось сохранить карту дня");
        throw new Error("saveCard failed");
      }
    },
    [data],
  );

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

  const value = useMemo<DailyCardContextValue>(
    () => ({
      refresh: applyStoredState,
      card,
      intention: data?.intention,
      loading,
      error,
      hasDrawn: !!data && isEntryValidForLocalToday(data),
      saveCard,
      clearDailyCard,
    }),
    [applyStoredState, card, data, loading, error, saveCard, clearDailyCard],
  );

  return <DailyCardContext.Provider value={value}>{children}</DailyCardContext.Provider>;
}

export function useDailyCard(): DailyCardContextValue {
  const ctx = useContext(DailyCardContext);
  if (!ctx) {
    throw new Error("useDailyCard must be used within DailyCardProvider");
  }
  return ctx;
}
