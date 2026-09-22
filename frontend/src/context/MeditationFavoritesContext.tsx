import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  mergeMeditationFavorites,
  setMeditationFavorite,
} from "../services/meditationFavorites";
import { useUser } from "./UserContext";

const STORAGE_PREFIX = "@mystix_meditation_favorites_v1";
const GUEST_KEY = `${STORAGE_PREFIX}:guest`;

type MeditationFavoritesContextValue = {
  hydrated: boolean;
  favoriteSlugs: string[];
  isFavorite: (slug: string) => boolean;
  isToggling: (slug: string) => boolean;
  toggleFavorite: (slug: string) => Promise<boolean>;
};

const MeditationFavoritesContext =
  createContext<MeditationFavoritesContextValue | undefined>(undefined);

function parseFavorites(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((slug): slug is string => typeof slug === "string");
  } catch {
    return [];
  }
}

function uniqueSlugs(...groups: string[][]): string[] {
  return [...new Set(groups.flat().map((slug) => slug.trim()).filter(Boolean))];
}

export function MeditationFavoritesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { hydrated: userHydrated, id: userId, token } = useUser();
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [busySlugs, setBusySlugs] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const storageKey = userId ? `${STORAGE_PREFIX}:${userId}` : GUEST_KEY;

  useEffect(() => {
    if (!userHydrated) return;
    let cancelled = false;

    void (async () => {
      const keys = userId ? [GUEST_KEY, storageKey] : [storageKey];
      const stored = await AsyncStorage.multiGet(keys);
      const local = uniqueSlugs(
        ...stored.map(([, raw]) => parseFavorites(raw)),
      );
      let resolved = local;

      if (token) {
        try {
          resolved = await mergeMeditationFavorites(token, local);
        } catch {
          // Offline users keep the last local state and sync next time.
        }
      }

      if (cancelled) return;
      setFavoriteSlugs(resolved);
      setHydrated(true);
      await AsyncStorage.setItem(storageKey, JSON.stringify(resolved));
    })();

    return () => {
      cancelled = true;
    };
  }, [storageKey, token, userHydrated, userId]);

  const isFavorite = useCallback(
    (slug: string) => favoriteSlugs.includes(slug),
    [favoriteSlugs],
  );

  const isToggling = useCallback(
    (slug: string) => busySlugs.includes(slug),
    [busySlugs],
  );

  const toggleFavorite = useCallback(
    async (slug: string) => {
      if (busySlugs.includes(slug)) return favoriteSlugs.includes(slug);
      const wasFavorite = favoriteSlugs.includes(slug);
      const nextFavorite = !wasFavorite;
      const next = nextFavorite
        ? uniqueSlugs(favoriteSlugs, [slug])
        : favoriteSlugs.filter((item) => item !== slug);

      setFavoriteSlugs(next);
      setBusySlugs((current) => uniqueSlugs(current, [slug]));
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));

      try {
        if (token) {
          await setMeditationFavorite(token, slug, nextFavorite);
        }
        return nextFavorite;
      } catch (error) {
        setFavoriteSlugs(favoriteSlugs);
        await AsyncStorage.setItem(storageKey, JSON.stringify(favoriteSlugs));
        throw error;
      } finally {
        setBusySlugs((current) => current.filter((item) => item !== slug));
      }
    },
    [busySlugs, favoriteSlugs, storageKey, token],
  );

  const value = useMemo(
    () => ({
      hydrated,
      favoriteSlugs,
      isFavorite,
      isToggling,
      toggleFavorite,
    }),
    [
      favoriteSlugs,
      hydrated,
      isFavorite,
      isToggling,
      toggleFavorite,
    ],
  );

  return (
    <MeditationFavoritesContext.Provider value={value}>
      {children}
    </MeditationFavoritesContext.Provider>
  );
}

export function useMeditationFavorites() {
  const value = useContext(MeditationFavoritesContext);
  if (!value) {
    throw new Error(
      "useMeditationFavorites must be used inside MeditationFavoritesProvider",
    );
  }
  return value;
}
