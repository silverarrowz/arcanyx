import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";

const DEFAULT_MIN_INTERVAL_MS = 12_000;

/** Refetch when the screen is focused or the app returns to the foreground. */
export function useRefreshOnFocusAndForeground(
  refresh: () => void | Promise<void>,
  minIntervalMs: number = DEFAULT_MIN_INTERVAL_MS,
) {
  const lastAt = useRef(0);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const run = useCallback(() => {
    const now = Date.now();
    if (lastAt.current > 0 && now - lastAt.current < minIntervalMs) return;
    lastAt.current = now;
    void refreshRef.current();
  }, [minIntervalMs]);

  useFocusEffect(
    useCallback(() => {
      run();
    }, [run]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") run();
    });
    return () => sub.remove();
  }, [run]);
}
