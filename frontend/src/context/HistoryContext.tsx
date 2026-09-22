import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fetchRemoteHistory,
  mergeRemoteHistory,
  saveRemoteHistory,
} from "../services/historyApi";
import { useUser } from "./UserContext";

export type TarotCardSnapshot = {
  positionId: string;
  positionLabelRu: string;
  cardId: string;
  cardName: string;
  /** Rider–Waite reversal. Absent on older saves = upright. */
  reversed?: boolean;
};

export type TarotChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type TarotChatState = {
  conversationId: string;
  topic?: string;
  question: string;
  followupsUsed: number;
  messages: TarotChatMessage[];
};

export type HistoryItem = {
  id: string;
  type: "oracle" | "tarot" | "dream" | "note";
  date: string; // ISO
  question: string;
  answer: string;
  category?: string; // oracle category color label
  oracleSource?: string;
  oracleSourceLabel?: string;
  cardId?: string; // tarot card id (one-card spread)
  cardName?: string;
  /** One-card / daily-card reversal. Absent on older saves = upright. */
  cardReversed?: boolean;
  outcome?: "fulfilled" | "failed" | null; // for oracle items
  // Tarot spread extensions (optional, backwards-compatible)
  spread?: string; // e.g. "one-card" | "three-time" | "three-situation" | "love-three" | legacy "three-card"
  spreadLabelRu?: string;
  intent?: string; // user-entered question ("О чём сейчас?")
  cardsSnapshot?: TarotCardSnapshot[];
  /** Short synthesized interpretation for multi-card spreads (local mock, no AI). */
  tarotSummaryRu?: string;
  /** User-written note for a tarot spread ("Моё толкование"). */
  userInterpretation?: string;
  /** AI chat transcript for this spread (Conversations API). */
  tarotChat?: TarotChatState;
  dreamText?: string;
  dreamInterpretation?: string;
  dreamSymbols?: string[];
  dreamAdvice?: string;
  /** Durable public URL of the generated dream illustration. */
  dreamImageUrl?: string;
  /** Illustration may still be generating after the interpretation is shown. */
  dreamImageStatus?: "pending" | "ready" | "failed";
  favorite?: boolean;
};

type HistoryItemPatch = Partial<Omit<HistoryItem, "id">>;

type HistoryContextValue = {
  items: HistoryItem[];
  hydrated: boolean;
  syncing: boolean;
  addItem: (item: Omit<HistoryItem, "id" | "date">) => string;
  updateItem: (id: string, patch: HistoryItemPatch) => void;
  setOutcome: (id: string, outcome: "fulfilled" | "failed" | null) => void;
  removeItem: (id: string) => void;
  clearItems: () => void;
  streak: number;
};

const GUEST_STORAGE_KEY = "@mystic_history_v1";

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

function userStorageKey(userId: string) {
  return `@mystic_history_user_v1:${userId}`;
}

function isSeedItem(item: HistoryItem) {
  return item.id.startsWith("seed-");
}

function parseStoredHistory(raw: string | null): HistoryItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

function guestItemsForMigration(...sources: HistoryItem[][]): HistoryItem[] {
  const byId = new Map<string, HistoryItem>();
  for (const items of sources) {
    for (const item of items) {
      if (
        !item?.id ||
        isSeedItem(item) ||
        !["tarot", "dream", "note"].includes(item.type)
      ) {
        continue;
      }
      if (!byId.has(item.id)) byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}

function mergeServerFirst(
  serverItems: HistoryItem[],
  localItems: HistoryItem[],
): HistoryItem[] {
  const byId = new Map<string, HistoryItem>();
  for (const item of serverItems) byId.set(item.id, item);
  for (const item of localItems) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export function HistoryProvider({ children }: { children: ReactNode }) {
  const {
    id: userId,
    token,
    isAuthenticated,
    hydrated: userHydrated,
  } = useUser();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [syncing, setSyncing] = useState(true);
  const itemsRef = useRef<HistoryItem[]>([]);
  const guestCache = useRef<HistoryItem[] | null>(null);
  const sourceRef = useRef<"guest" | "user">("guest");
  const skipPersistOnce = useRef(false);
  const skipRemoteSync = useRef(true);
  const lastAuthKey = useRef<string | null>(null);
  const authGeneration = useRef(0);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(GUEST_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as HistoryItem[];
          guestCache.current = parsed;
          setItems(parsed);
        } else {
          guestCache.current = seedItems;
          setItems(seedItems);
          await AsyncStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(seedItems));
        }
      } catch {
        guestCache.current = seedItems;
        setItems(seedItems);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated || !userHydrated) return;

    const authKey = isAuthenticated && token && userId ? userId : null;
    if (lastAuthKey.current === authKey) return;
    lastAuthKey.current = authKey;
    const generation = ++authGeneration.current;

    if (!authKey || !token) {
      skipPersistOnce.current = true;
      skipRemoteSync.current = true;
      sourceRef.current = "guest";
      setSyncing(false);
      setItems(guestCache.current ?? seedItems);
      return;
    }

    let cancelled = false;
    skipPersistOnce.current = true;
    skipRemoteSync.current = true;
    sourceRef.current = "user";
    setSyncing(true);
    const itemsAtLogin = itemsRef.current;
    const itemIdsAtLogin = new Set(itemsAtLogin.map((item) => item.id));

    (async () => {
      let serverConfirmed = false;
      let accountCache: HistoryItem[] = [];
      let confirmedServerItems: HistoryItem[] | null = null;
      try {
        const [cachedRaw, guestRaw] = await Promise.all([
          AsyncStorage.getItem(userStorageKey(authKey)),
          AsyncStorage.getItem(GUEST_STORAGE_KEY),
        ]);
        accountCache = parseStoredHistory(cachedRaw);
        if (
          !cancelled &&
          generation === authGeneration.current &&
          lastAuthKey.current === authKey
        ) {
          setItems(accountCache);
        }
        const storedGuestItems = parseStoredHistory(guestRaw);
        const guestSnapshot = guestItemsForMigration(
          storedGuestItems,
          guestCache.current ?? [],
          itemsAtLogin,
        );

        let serverItems =
          guestSnapshot.length > 0
            ? await mergeRemoteHistory(token, guestSnapshot)
            : await fetchRemoteHistory(token);
        confirmedServerItems = serverItems;
        serverConfirmed = true;
        if (
          cancelled ||
          generation !== authGeneration.current ||
          lastAuthKey.current !== authKey
        ) {
          return;
        }

        // Preserve an item created after OAuth returned but before migration finished.
        const serverIds = new Set(serverItems.map((item) => item.id));
        const pendingItems = guestItemsForMigration(itemsRef.current).filter(
          (item) => !serverIds.has(item.id),
        );
        if (pendingItems.length > 0) {
          serverItems = await mergeRemoteHistory(token, pendingItems);
          confirmedServerItems = serverItems;
        }
        if (
          cancelled ||
          generation !== authGeneration.current ||
          lastAuthKey.current !== authKey
        ) {
          return;
        }

        const newestPendingItems = guestItemsForMigration(itemsRef.current);
        const mergedItems = mergeServerFirst(serverItems, newestPendingItems);

        await AsyncStorage.multiSet([
          [userStorageKey(authKey), JSON.stringify(mergedItems)],
          [GUEST_STORAGE_KEY, JSON.stringify([])],
        ]);
        if (
          cancelled ||
          generation !== authGeneration.current ||
          lastAuthKey.current !== authKey
        ) {
          return;
        }

        guestCache.current = [];
        setItems(mergedItems);
      } catch {
        // Keep guest data for a later retry and preserve actions made during login.
        if (
          !cancelled &&
          generation === authGeneration.current &&
          lastAuthKey.current === authKey
        ) {
          const createdDuringLogin = itemsRef.current.filter(
            (item) => !isSeedItem(item) && !itemIdsAtLogin.has(item.id),
          );
          setItems(
            mergeServerFirst(
              confirmedServerItems ?? accountCache,
              createdDuringLogin,
            ),
          );
        }
      } finally {
        if (
          !cancelled &&
          generation === authGeneration.current &&
          lastAuthKey.current === authKey
        ) {
          setSyncing(false);
          if (serverConfirmed) {
            skipRemoteSync.current = false;
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, userHydrated, isAuthenticated, token, userId]);

  useEffect(() => {
    if (!hydrated) return;
    if (skipPersistOnce.current) {
      skipPersistOnce.current = false;
      return;
    }
    if (sourceRef.current === "user" && userId) {
      AsyncStorage.setItem(userStorageKey(userId), JSON.stringify(items)).catch(() => {});
      return;
    }
    if (sourceRef.current === "guest") {
      guestCache.current = items;
      AsyncStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(items)).catch(() => {});
    }
  }, [items, hydrated, userId]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !token || skipRemoteSync.current) return;
    const handle = setTimeout(() => {
      saveRemoteHistory(
        token,
        itemsRef.current.filter((item) => !isSeedItem(item)),
      ).catch(() => {});
    }, 600);
    return () => clearTimeout(handle);
  }, [items, hydrated, isAuthenticated, token]);

  const addItem = useCallback(
    (item: Omit<HistoryItem, "id" | "date">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setItems((prev) => [
        {
          ...item,
          id,
          date: new Date().toISOString(),
        },
        ...prev,
      ]);
      return id;
    },
    [],
  );

  const updateItem = useCallback((id: string, patch: HistoryItemPatch) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  }, []);

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

  const clearItems = useCallback(() => {
    setItems([]);
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
    () => ({
      items,
      hydrated,
      syncing,
      addItem,
      updateItem,
      setOutcome,
      removeItem,
      clearItems,
      streak,
    }),
    [items, hydrated, syncing, addItem, updateItem, setOutcome, removeItem, clearItems, streak],
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
