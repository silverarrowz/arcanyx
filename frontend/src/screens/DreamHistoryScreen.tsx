import React, { useMemo, useRef, useState } from "react";
import { useRouter, useScrollToTop } from "expo-router";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Search, Sparkles, Star, Trash2 } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { theme } from "../theme";
import CosmicBackground from "../components/CosmicBackground";
import GlassCard from "../components/GlassCard";
import ScreenHeading from "../components/ScreenHeading";
import { useHistory } from "../context/HistoryContext";

const H_PAD = 24;

type DreamFilter = "all" | "favorites";

type DreamHistoryEntry = {
  id: string;
  title: string;
  snippet: string;
  date: string;
  tags: string[];
  favorite: boolean;
  imageUrl?: string;
};

const FILTERS: { id: DreamFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "favorites", label: "Избранные" },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  const time = d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (sameDay) return `Сегодня · ${time}`;
  if (isYesterday) return `Вчера · ${time}`;

  return (
    d.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "long",
    }) + ` · ${time}`
  );
}

type Props = {
  embedded?: boolean;
};

export default function DreamHistoryScreen({ embedded = false }: Props) {
  const router = useRouter();
  const { items, removeItem, updateItem } = useHistory();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DreamFilter>("all");

  const dreams = useMemo<DreamHistoryEntry[]>(() => {
    return items
      .filter((item) => item.type === "dream")
      .map((item) => {
        const tags = item.dreamSymbols ?? [];
        const interpretation = item.dreamInterpretation ?? item.answer;
        const title = item.answer || "Толкование сна";
        return {
          id: item.id,
          title,
          snippet: interpretation,
          date: formatDate(item.date),
          tags,
          favorite: Boolean(item.favorite),
          imageUrl: item.dreamImageUrl,
        };
      });
  }, [items]);

  const filteredDreams = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...dreams];

    if (filter === "favorites") {
      list = list.filter((d) => d.favorite);
    }

    if (!q) return list;
    return list.filter((d) => {
      const hay = `${d.title} ${d.snippet} ${d.tags.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, filter, dreams]);

  const toggleFavorite = (id: string, favorite: boolean) => {
    updateItem(id, { favorite: !favorite });
  };

  const confirmDelete = (id: string) => {
    Alert.alert(
      "Удалить запись?",
      "Восстановить её после удаления не получится.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning,
            ).catch(() => {});
            removeItem(id);
          },
        },
      ],
    );
  };

  const body = (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets
    >
      <ScreenHeading
        title="История снов"
        deck="Ищите записи по символам и замечайте повторяющиеся образы."
      />

      <View style={styles.searchShell}>
        <Search color={theme.colors.textMuted} size={17} strokeWidth={2} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск по снам и символам"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={({ pressed }) => [
                styles.filterPill,
                active && styles.filterPillActive,
                pressed && !active && { opacity: 0.9 },
              ]}
            >
              {active ? (
                <LinearGradient
                  colors={["rgba(201,168,255,0.14)", "rgba(44,35,64,0.32)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              <Text
                style={[styles.filterPillText, active && styles.filterPillTextActive]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
        </ScrollView>
      </View>

      {filteredDreams.map((d) => {
        const isFav = d.favorite;
        return (
          <Pressable
            key={d.id}
            onPress={() => router.push(`/dream-result?id=${encodeURIComponent(d.id)}` as never)}
            style={({ pressed }) => [styles.dreamCardPress, pressed && { opacity: 0.94 }]}
          >
            <GlassCard
              borderColor={theme.colors.borderPurple}
              intensity={18}
              surfaceColor="rgba(98,82,142,0.12)"
              overlayColor="rgba(116,95,168,0.1)"
              style={styles.dreamCard}
            >
              <View style={styles.dreamCardInner}>
                <View style={styles.dreamMetaRow}>
                  <Text style={styles.dreamDate}>{d.date}</Text>
                  <Pressable
                    hitSlop={10}
                    onPress={(event) => {
                      event.stopPropagation();
                      toggleFavorite(d.id, isFav);
                    }}
                    accessibilityLabel={isFav ? "Убрать из избранного" : "Добавить в избранное"}
                    style={styles.starBtn}
                  >
                    <Star
                      color={isFav ? theme.colors.gold : theme.colors.textMuted}
                      size={16}
                      strokeWidth={1.7}
                      fill={isFav ? theme.colors.gold : "none"}
                    />
                  </Pressable>
                </View>

                <Text style={styles.dreamTitle} numberOfLines={2}>
                  {d.title}
                </Text>
                {d.imageUrl ? (
                  <Image
                    source={{ uri: d.imageUrl }}
                    style={styles.dreamThumb}
                    contentFit="cover"
                  />
                ) : null}
                <Text style={styles.dreamSnippet} numberOfLines={2}>
                  {d.snippet}
                </Text>

                <View style={styles.dreamFooter}>
                  <View style={styles.dreamTags}>
                    {d.tags.slice(0, 3).map((t) => (
                      <View key={t} style={styles.tagChip}>
                        <Text style={styles.tagChipText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                  <Pressable
                    hitSlop={8}
                    onPress={(event) => {
                      event.stopPropagation();
                      confirmDelete(d.id);
                    }}
                    testID={`delete-dream-${d.id}`}
                    accessibilityRole="button"
                    accessibilityLabel="Удалить запись сна"
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed && styles.deleteButtonPressed,
                    ]}
                  >
                    <Trash2
                      color={theme.colors.textDim}
                      size={16}
                      strokeWidth={1.7}
                    />
                  </Pressable>
                </View>
              </View>
            </GlassCard>
          </Pressable>
        );
      })}

      {filteredDreams.length === 0 ? (
        <View style={styles.empty}>
          <Sparkles color={theme.colors.textDim} size={26} strokeWidth={1.7} />
          <Text style={styles.emptyTitle}>История снов пока пуста</Text>
          <Text style={styles.emptyText}>
            Добавьте толкование в разделе Сонник — и оно появится здесь.
          </Text>
        </View>
      ) : null}

      <View style={{ height: 120 }} />
    </ScrollView>
  );

  if (embedded) {
    return <View style={styles.embedRoot}>{body}</View>;
  }

  return (
    <View style={styles.root}>
      <CosmicBackground variant="dream" />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {body}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  embedRoot: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: H_PAD,
    paddingTop: 4,
    paddingBottom: 24,
  },

  /** Как первая вкладка Сонник / Таро — heroCopy */
  heroCopy: {
    paddingTop: 10,
    alignItems: "center",
    marginBottom: 16,
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
    marginBottom: 4,
    maxWidth: 280,
  },

  /** Компактная строка поиска без Blur — без «лишних» бликов и лишней высоты */
  searchShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    maxHeight: 44,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: "rgba(26,23,43,0.92)",
    marginBottom: 20,
    overflow: "hidden",
  },
  searchInput: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: Platform.OS === "ios" ? 18 : 20,
    color: theme.colors.text,
    paddingVertical: Platform.OS === "ios" ? 8 : 6,
    paddingHorizontal: 0,
    margin: 0,
    minHeight: 36,
    maxHeight: 40,
  },

  filterWrap: {
    marginTop: 2,
    marginBottom: 12,
  },
  filterScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 8,
  },
  filterPill: {
    position: "relative",
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.archive.rule,
    backgroundColor: "rgba(20,18,28,0.65)",
    overflow: "hidden",
  },
  filterPillActive: {
    borderColor: "rgba(201,168,255,0.28)",
  },
  filterPillText: {
    zIndex: 1,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 0.3,
    color: theme.colors.textDim,
  },
  filterPillTextActive: {
    color: theme.colors.text,
  },

  dreamCardPress: {
    marginBottom: 14,
  },
  dreamCard: {
    borderRadius: theme.radius.lg,
    overflow: "hidden",
  },
  dreamCardInner: {
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 18,
  },
  dreamMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  dreamDate: {
    flex: 1,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.2,
    color: theme.colors.textMuted,
  },
  dreamTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: 20,
    lineHeight: 26,
    color: theme.colors.text,
    marginBottom: 8,
  },
  dreamThumb: {
    width: "100%",
    height: 148,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: "rgba(246,240,255,0.08)",
  },
  dreamSnippet: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textDim,
  },
  dreamFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    gap: 10,
  },
  dreamTags: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    backgroundColor: "rgba(255,215,154,0.06)",
  },
  tagChipText: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 9,
    letterSpacing: 1.1,
    color: theme.colors.gold,
  },
  starBtn: {
    padding: 2,
    flexShrink: 0,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(18,16,34,0.58)",
  },
  deleteButtonPressed: {
    opacity: 0.68,
    transform: [{ scale: 0.94 }],
  },
  empty: {
    alignItems: "center",
    paddingTop: 56,
    gap: 10,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 20,
  },
  emptyText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 270,
  },
});
