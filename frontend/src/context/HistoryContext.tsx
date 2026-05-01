import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type TarotCardSnapshot = {
  positionId: string;
  positionLabelRu: string;
  cardId: string;
  cardName: string;
};

export type HistoryItem = {
  id: string;
  type: "oracle" | "tarot";
  date: string; // ISO
  question: string;
  answer: string;
  category?: string; // oracle category color label
  oracleSource?: string;
  oracleSourceLabel?: string;
  cardId?: string; // tarot card id (one-card spread)
  cardName?: string;
  outcome?: "fulfilled" | "failed" | null; // for oracle items
  // Tarot spread extensions (optional, backwards-compatible)
  spread?: string; // e.g. "one-card" | "three-time" | "three-situation" | "love-three" | legacy "three-card"
  spreadLabelRu?: string;
  intent?: string; // user-entered question ("О чём сейчас?")
  cardsSnapshot?: TarotCardSnapshot[];
  /** Short synthesized interpretation for multi-card spreads (local mock, no AI). */
  tarotSummaryRu?: string;
};

type HistoryContextValue = {
  items: HistoryItem[];
  addItem: (item: Omit<HistoryItem, "id" | "date">) => void;
  setOutcome: (id: string, outcome: "fulfilled" | "failed" | null) => void;
  removeItem: (id: string) => void;
  streak: number;
};

const STORAGE_KEY = "@mystic_history_v1";

const seedItems: HistoryItem[] = [
  {
    id: "seed-1",
    type: "oracle",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    question: "Стоит ли мне поменять работу?",
    answer: "Всё складывается в твою пользу",
    category: "yes",
    outcome: "fulfilled",
  },
  {
    id: "seed-2",
    type: "tarot",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    question: "Карта дня",
    answer: "Звезда — надежда и духовное обновление.",
    cardId: "star",
    cardName: "Звезда",
  },
  {
    id: "seed-3",
    type: "oracle",
    date: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    question: "Сегодня встречу его?",
    answer: "Пока неясно",
    category: "vague",
    outcome: null,
  },
];

const HistoryContext = createContext<HistoryContextValue | undefined>(undefined);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as HistoryItem[];
          setItems(parsed);
        } else {
          setItems(seedItems);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seedItems));
        }
      } catch {
        setItems(seedItems);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }, [items, hydrated]);

  const addItem = useCallback(
    (item: Omit<HistoryItem, "id" | "date">) => {
      setItems((prev) => [
        {
          ...item,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          date: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    [],
  );

  const setOutcome = useCallback(
    (id: string, outcome: "fulfilled" | "failed" | null) => {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, outcome } : it)),
      );
    },
    [],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  // Simple streak: count of unique consecutive days with at least one item, ending today/yesterday
  const streak = useMemo(() => {
    if (items.length === 0) return 0;
    const days = new Set<string>();
    for (const it of items) {
      const d = new Date(it.date);
      days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    let s = 0;
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (days.has(key)) s++;
      else if (i === 0) continue;
      else break;
    }
    return Math.max(s, 3); // baseline 3 for vibe
  }, [items]);

  const value = useMemo(
    () => ({ items, addItem, setOutcome, removeItem, streak }),
    [items, addItem, setOutcome, removeItem, streak],
  );

  return (
    <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
  );
}

export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error("useHistory must be used inside HistoryProvider");
  return ctx;
}
