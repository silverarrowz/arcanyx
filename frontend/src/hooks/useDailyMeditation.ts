import { useCallback, useEffect, useMemo, useState } from "react";
import { Image } from "expo-image";
import { todayKey } from "../context/DailyCardContext";
import {
  currentDaySlot,
  pickDailyMeditation,
  type DaySlot,
} from "../services/dailyMeditation";
import {
  fetchMeditations,
  meditationCoverUrl,
  readCachedMeditations,
  type Meditation,
} from "../services/meditations";
import { useRefreshOnFocusAndForeground } from "./useRefreshOnFocusAndForeground";

/** Часть суток меняется по часам, поэтому пересчитываем чаще, чем дату. */
const SLOT_POLL_MS = 60_000;

/**
 * Медитация дня для плитки «Ритуалы на сегодня»: сперва из кэша каталога,
 * затем обновляется с сервера при фокусе экрана и возврате из фона.
 */
export function useDailyMeditation(): {
  meditation: Meditation | null;
  slot: DaySlot;
} {
  const [items, setItems] = useState<Meditation[]>([]);
  const [dayKey, setDayKey] = useState(() => todayKey());
  const [slot, setSlot] = useState<DaySlot>(() => currentDaySlot());

  const syncNow = useCallback(() => {
    setDayKey(todayKey());
    setSlot(currentDaySlot());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cached = await readCachedMeditations();
      if (!cancelled && cached?.items?.length) setItems(cached.items);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    syncNow();
    try {
      const data = await fetchMeditations();
      if (Array.isArray(data?.items)) setItems(data.items);
    } catch {
      // Оставляем последний известный каталог.
    }
  }, [syncNow]);

  useRefreshOnFocusAndForeground(refresh);

  useEffect(() => {
    const id = setInterval(syncNow, SLOT_POLL_MS);
    return () => clearInterval(id);
  }, [syncNow]);

  const meditation = useMemo(
    () => pickDailyMeditation(items, dayKey, slot),
    [items, dayKey, slot],
  );

  useEffect(() => {
    if (!meditation) return;
    const cover = meditationCoverUrl(meditation);
    if (cover) void Image.prefetch(cover, "memory-disk").catch(() => null);
  }, [meditation]);

  return { meditation, slot };
}
