import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

/** Bump key after blur → focus so keyed children remount (scroll/local UI reset). */
export function useRemountOnTabFocus(): number {
  const [key, setKey] = useState(0);
  const wasBlurred = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (wasBlurred.current) {
        setKey((k) => k + 1);
      }
      return () => {
        wasBlurred.current = true;
      };
    }, []),
  );
  return key;
}
