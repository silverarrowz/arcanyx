import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import {
  TAROT_SPREADS,
  type TarotSpread,
  getSpreadById as getBundledSpreadById,
} from "../data/tarotSpreads";
import {
  fetchTarotSpreads,
  readCachedTarotSpreads,
} from "../services/tarotSpreads";
import { prefetchTarotSpreadImages } from "../utils/prefetchImages";

type TarotSpreadsContextValue = {
  spreads: TarotSpread[];
  hydrated: boolean;
  refresh: () => Promise<void>;
  getSpreadById: (id: string) => TarotSpread;
};

const TarotSpreadsContext =
  createContext<TarotSpreadsContextValue | undefined>(undefined);

export function TarotSpreadsProvider({ children }: { children: ReactNode }) {
  const [spreads, setSpreads] = useState<TarotSpread[]>(TAROT_SPREADS);
  const [hydrated, setHydrated] = useState(false);
  const lastFetchedAt = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);

  const applySpreads = useCallback((items: TarotSpread[]) => {
    setSpreads(items);
    prefetchTarotSpreadImages(
      items
        .map((spread) => spread.coverUrl)
        .filter((url): url is string => Boolean(url)),
    );
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      if (
        !force &&
        lastFetchedAt.current > 0 &&
        Date.now() - lastFetchedAt.current < 12_000
      ) {
        return;
      }
      if (inFlight.current) {
        await inFlight.current;
        return;
      }
      const task = (async () => {
        try {
          const fresh = await fetchTarotSpreads();
          applySpreads(fresh);
          lastFetchedAt.current = Date.now();
        } catch {
          // Bundled/cached spreads keep tarot available offline.
        } finally {
          setHydrated(true);
        }
      })();
      inFlight.current = task;
      try {
        await task;
      } finally {
        if (inFlight.current === task) inFlight.current = null;
      }
    },
    [applySpreads],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cached = await readCachedTarotSpreads();
      if (!cancelled && cached) {
        applySpreads(cached);
      }
      if (!cancelled) {
        await refresh(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySpreads, refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const refreshPublic = useCallback(() => refresh(), [refresh]);

  const getSpreadById = useCallback(
    (id: string) => {
      const normalized = id === "three-card" ? "three-situation" : id;
      return (
        spreads.find((spread) => spread.id === normalized) ??
        getBundledSpreadById(normalized)
      );
    },
    [spreads],
  );

  const value = useMemo(
    () => ({
      spreads,
      hydrated,
      refresh: refreshPublic,
      getSpreadById,
    }),
    [getSpreadById, hydrated, refreshPublic, spreads],
  );

  return (
    <TarotSpreadsContext.Provider value={value}>
      {children}
    </TarotSpreadsContext.Provider>
  );
}

export function useTarotSpreads() {
  const value = useContext(TarotSpreadsContext);
  if (!value) {
    throw new Error("useTarotSpreads must be used inside TarotSpreadsProvider");
  }
  return value;
}
