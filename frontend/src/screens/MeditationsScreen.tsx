import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useScrollToTop } from "expo-router";
import { useRefreshOnFocusAndForeground } from "../hooks/useRefreshOnFocusAndForeground";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Headphones, Heart, Search } from "lucide-react-native";
import { theme } from "../theme";
import CosmicBackground from "../components/CosmicBackground";
import GlassCard from "../components/GlassCard";
import ScreenHeading from "../components/ScreenHeading";
import { useMeditationFavorites } from "../context/MeditationFavoritesContext";
import {
  fetchMeditations,
  readCachedMeditations,
  meditationCoverUrl,
  type Meditation,
} from "../services/meditations";
import { ApiError } from "../services/api";

const FALLBACK_COVERS = [
  require("../../assets/home/bg-energy.jpg"),
  require("../../assets/home/bg-main-bottom.jpg"),
  require("../../assets/oracle/bg2.jpg"),
  require("../../assets/home/bg-main3.jpg"),
];

const H_PAD = 24;
const TAB_CLEARANCE = 118;
const GRID_GAP = 12;

function coverSource(item: Meditation, index: number, failed?: boolean) {
  const remote = failed ? null : meditationCoverUrl(item);
  if (remote) return { uri: remote };
  return FALLBACK_COVERS[index % FALLBACK_COVERS.length];
}

function approximateDuration(seconds: number): string {
  return `~${Math.max(1, Math.round(seconds / 60))} мин`;
}

function filterCatalog(
  items: Meditation[],
  query: string,
  tag: string | null,
): Meditation[] {
  const q = query.trim().toLowerCase();
  const tagN = tag?.trim().toLowerCase() ?? "";
  return items.filter((item) => {
    if (tagN && !(item.tags ?? []).some((name) => name.toLowerCase() === tagN)) {
      return false;
    }
    if (!q) return true;
    const hay = `${item.title} ${item.description} ${(item.tags ?? []).join(" ")}`.toLowerCase();
    return hay.includes(q);
  });
}

export default function MeditationsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [items, setItems] = useState<Meditation[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedCovers, setFailedCovers] = useState<Record<string, boolean>>({});
  const {
    favoriteSlugs,
    isFavorite,
    isToggling,
    toggleFavorite,
  } = useMeditationFavorites();

  const cardWidth = (width - H_PAD * 2 - GRID_GAP) / 2;

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(id);
  }, [query]);

  const load = useCallback(async () => {
    const cached = await readCachedMeditations();
    if (cached) {
      setItems(cached.items);
      setTags(cached.tags);
      setLoading(false);
    }
    try {
      const data = await fetchMeditations();
      setItems(data.items);
      setTags(data.tags);
      setError(null);
    } catch (err) {
      if (cached) return;
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Не удалось загрузить медитации",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const inFlight = useRef<Promise<void> | null>(null);
  const loadOnce = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    const task = load().finally(() => {
      if (inFlight.current === task) inFlight.current = null;
    });
    inFlight.current = task;
    return task;
  }, [load]);

  useRefreshOnFocusAndForeground(loadOnce);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadOnce();
    } finally {
      setRefreshing(false);
    }
  }, [loadOnce]);

  const visibleItems = useMemo(() => {
    const filtered = filterCatalog(items, debounced, tag);
    return favoritesOnly
      ? filtered.filter((item) => favoriteSlugs.includes(item.slug))
      : filtered;
  }, [debounced, favoriteSlugs, favoritesOnly, items, tag]);

  const openItem = (item: Meditation) => {
    Haptics.selectionAsync().catch(() => {});
    const cover = meditationCoverUrl(item);
    if (cover) {
      void Image.prefetch(cover, "memory-disk");
    }
    router.push(`/meditation-player?slug=${encodeURIComponent(item.slug)}` as never);
  };

  const chipLabels = useMemo(() => ["Все", ...tags], [tags]);

  return (
    <View style={styles.root}>
      <CosmicBackground variant="tarot" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={theme.colors.archive.accent}
              colors={[theme.colors.archive.accent]}
              progressBackgroundColor={theme.colors.surface}
            />
          }
        >
          <ScreenHeading
            title="Медитации"
            deck="Библиотека практик: найдите свою по тегу или названию."
          />

          <GlassCard
            borderColor={theme.colors.borderPurple}
            intensity={18}
            surfaceColor="rgba(98,82,142,0.14)"
            overlayColor="rgba(116,95,168,0.1)"
            style={styles.searchCard}
          >
            <View style={styles.searchRow}>
              <Search color={theme.colors.gold} size={16} strokeWidth={1.8} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Поиск по названию или тегу"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
            </View>
          </GlassCard>

          {tags.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setFavoritesOnly((current) => !current);
                  setTag(null);
                }}
                style={({ pressed }) => [
                  styles.chip,
                  styles.favoriteChip,
                  favoritesOnly && styles.chipActive,
                  pressed && { opacity: 0.88 },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: favoritesOnly }}
              >
                <Heart
                  color={favoritesOnly ? theme.colors.archive.accent : theme.colors.textDim}
                  size={14}
                  strokeWidth={1.8}
                  fill={favoritesOnly ? theme.colors.archive.accent : "none"}
                />
                <Text
                  style={[
                    styles.chipText,
                    favoritesOnly && styles.chipTextActive,
                  ]}
                >
                  Избранное
                </Text>
              </Pressable>
              {chipLabels.map((label) => {
                const value = label === "Все" ? null : label;
                const active =
                  !favoritesOnly &&
                  ((value === null && tag === null) || tag === value);
                return (
                  <Pressable
                    key={label}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setFavoritesOnly(false);
                      setTag(value);
                    }}
                    style={({ pressed }) => [
                      styles.chip,
                      active && styles.chipActive,
                      pressed && { opacity: 0.88 },
                    ]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={theme.colors.gold} />
            </View>
          ) : error && items.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={styles.emptyTitle}>Каталог пока недоступен</Text>
              <Text style={styles.emptyText}>{error}</Text>
              <Pressable onPress={() => void loadOnce()} style={styles.retryBtn}>
                <Text style={styles.retryText}>Повторить</Text>
              </Pressable>
            </View>
          ) : visibleItems.length === 0 ? (
            <View style={styles.centerBox}>
              <Headphones color={theme.colors.textMuted} size={26} strokeWidth={1.6} />
              <Text style={styles.emptyTitle}>Ничего не нашлось</Text>
              <Text style={styles.emptyText}>
                {favoritesOnly
                  ? "Добавляйте медитации сердечком — они появятся здесь."
                  : "Попробуйте другой запрос или сбросьте тег."}
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {visibleItems.map((item, index) => (
                <Pressable
                  key={item.slug}
                  onPress={() => openItem(item)}
                  style={({ pressed }) => [
                    styles.cardPress,
                    { width: cardWidth },
                    pressed && { opacity: 0.92 },
                  ]}
                >
                  <View style={styles.cardClip}>
                    <Image
                      source={coverSource(item, index, failedCovers[item.slug])}
                      placeholder={FALLBACK_COVERS[index % FALLBACK_COVERS.length]}
                      placeholderContentFit="cover"
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      recyclingKey={item.slug}
                      transition={160}
                      onError={() =>
                        setFailedCovers((prev) => ({ ...prev, [item.slug]: true }))
                      }
                    />
                    <LinearGradient
                      pointerEvents="none"
                      colors={[
                        "rgba(0,0,0,0)",
                        "rgba(28,22,48,0.14)",
                        "rgba(18,12,34,0.48)",
                        "rgba(10,7,22,0.78)",
                        "rgba(6,4,14,0.94)",
                      ]}
                      locations={[0, 0.42, 0.62, 0.82, 1]}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <LinearGradient
                      pointerEvents="none"
                      colors={["transparent", "rgba(8,4,18,0.72)", "rgba(4,2,12,0.96)"]}
                      locations={[0, 0.55, 1]}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={styles.cardTextBand}
                    />
                    <View style={styles.durationPill}>
                      <Text style={styles.durationText}>
                        {approximateDuration(item.durationSec)}
                      </Text>
                    </View>
                    <Pressable
                      hitSlop={8}
                      disabled={isToggling(item.slug)}
                      onPress={(event) => {
                        event.stopPropagation();
                        Haptics.selectionAsync().catch(() => {});
                        void toggleFavorite(item.slug).catch(() => {});
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isFavorite(item.slug)
                          ? "Убрать из избранного"
                          : "Добавить в избранное"
                      }
                      style={({ pressed }) => [
                        styles.favoriteButton,
                        pressed && { transform: [{ scale: 0.94 }] },
                        isToggling(item.slug) && { opacity: 0.55 },
                      ]}
                    >
                      <Heart
                        color={
                          isFavorite(item.slug)
                            ? theme.colors.gold
                            : "rgba(255,255,255,0.92)"
                        }
                        size={17}
                        strokeWidth={1.8}
                        fill={
                          isFavorite(item.slug) ? theme.colors.gold : "none"
                        }
                      />
                    </Pressable>
                    <View style={styles.cardFooter}>
                      <Text style={styles.cardTitle} numberOfLines={3}>
                        {item.title}
                      </Text>
                      {item.tags[0] ? (
                        <Text style={styles.cardSub} numberOfLines={2}>
                          {item.tags[0]}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: H_PAD,
    paddingBottom: TAB_CLEARANCE,
  },
  heroCopy: {
    paddingTop: 14,
    alignItems: "center",
    marginBottom: 6,
  },
  heroDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    opacity: 0.68,
  },
  heroDividerLine: {
    width: 54,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.borderGold,
  },
  heroDividerStar: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.heading,
    fontSize: 14,
  },
  title: {
    fontFamily: theme.fonts.display,
    color: theme.colors.text,
    fontSize: 34,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  subtitle: {
    color: theme.colors.lilac,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 14,
    maxWidth: 300,
  },
  searchCard: { marginBottom: 14 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    paddingVertical: 0,
  },
  chipsRow: {
    gap: 8,
    paddingBottom: 16,
    paddingRight: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(35,31,58,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  favoriteChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipActive: {
    borderColor: "rgba(201,168,255,0.28)",
    backgroundColor: "rgba(201,168,255,0.1)",
  },
  chipText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
  },
  chipTextActive: { color: theme.colors.text },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  cardPress: {
    borderRadius: 26,
    shadowColor: "#05030D",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.38,
    shadowRadius: 22,
    elevation: 11,
  },
  cardClip: {
    aspectRatio: 4 / 5,
    width: "100%",
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#1a1428",
  },
  cardTextBand: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "46%",
    zIndex: 1,
  },
  durationPill: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 2,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(8,6,18,0.56)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  durationText: {
    color: "rgba(255,255,255,0.94)",
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.25,
  },
  favoriteButton: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 3,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,6,18,0.56)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  cardFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingTop: 20,
    paddingBottom: 12,
    alignItems: "center",
    zIndex: 2,
    gap: 6,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontFamily: theme.fonts.heading,
    fontSize: 14,
    lineHeight: 17,
    letterSpacing: 0.5,
    textAlign: "center",
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.58)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 14,
  },
  cardSub: {
    color: "rgba(255,255,255,0.68)",
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.25,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  centerBox: {
    alignItems: "center",
    paddingTop: 36,
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.headingBold,
    fontSize: 18,
    textAlign: "center",
  },
  emptyText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
  },
});
