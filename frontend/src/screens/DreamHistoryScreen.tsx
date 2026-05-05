import React, { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bird,
  Moon,
  Search,
  Sparkles,
  Star,
  Store,
  Waves,
} from "lucide-react-native";
import { theme } from "../theme";
import CosmicBackground from "../components/CosmicBackground";
import GlassCard from "../components/GlassCard";
import { useHistory } from "../context/HistoryContext";

const H_PAD = 24;

type DreamFilter = "all" | "recent" | "frequent" | "favorites";

type DreamHistoryEntry = {
  id: string;
  title: string;
  snippet: string;
  date: string;
  tags: string[];
  favorite: boolean;
  frequencyScore: number;
};

const FILTERS: { id: DreamFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "recent", label: "Недавние" },
  { id: "frequent", label: "Частые" },
  { id: "favorites", label: "Избранные" },
];

function dreamIcon(key: string) {
  switch (key) {
    case "d1":
      return { Icon: Waves, tint: "#61A5FA" };
    case "d2":
      return { Icon: Bird, tint: "#FDA4AF" };
    case "d3":
      return { Icon: Store, tint: "#C47BEA" };
    case "d4":
      return { Icon: Moon, tint: "#9D7CE6" };
    default:
      return { Icon: Sparkles, tint: theme.colors.gold };
  }
}

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
  const { items } = useHistory();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DreamFilter>("all");
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const dreams = useMemo<DreamHistoryEntry[]>(() => {
    return items
      .filter((item) => item.type === "dream")
      .map((item) => {
        const tags = item.dreamSymbols && item.dreamSymbols.length > 0
          ? item.dreamSymbols
          : ["сон"];
        const interpretation = item.dreamInterpretation ?? item.answer;
        const title = item.answer || "Толкование сна";
        return {
          id: item.id,
          title,
          snippet: interpretation,
          date: formatDate(item.date),
          tags,
          favorite: Boolean(favorites[item.id]),
          frequencyScore: tags.length,
        };
      });
  }, [favorites, items]);

  const symbolStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const dream of dreams) {
      for (const tag of dream.tags) {
        const key = tag.trim().toLowerCase();
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, count]) => ({ key: label, label, count }));
  }, [dreams]);

  const filteredDreams = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...dreams];

    if (filter === "recent") {
      list = list.slice(0, 3);
    } else if (filter === "frequent") {
      list.sort((a, b) => b.frequencyScore - a.frequencyScore);
    } else if (filter === "favorites") {
      list = list.filter((d) => favorites[d.id] || d.favorite);
    }

    if (!q) return list;
    return list.filter((d) => {
      const hay = `${d.title} ${d.snippet} ${d.tags.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, filter, favorites, dreams]);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const body = (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.heroCopy}>
        <View style={styles.heroDivider}>
          <View style={styles.heroDividerLine} />
          <Text style={styles.heroDividerStar}>✦</Text>
          <View style={styles.heroDividerLine} />
        </View>
        <Text style={styles.title}>История снов</Text>
        <Text style={styles.subtitle}>
          Ищите записи по символам и замечайте повторяющиеся образы.
        </Text>
      </View>

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

      <View style={styles.popularHead}>
        <Text style={styles.popularHeadText}>✦ ПОПУЛЯРНЫЕ СИМВОЛЫ</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.symbolChipsRow}
      >
        {symbolStats.map((s) => (
          <Pressable
            key={s.key}
            style={({ pressed }) => [styles.symbolStatChip, pressed && { opacity: 0.88 }]}
            onPress={() => setQuery(s.label)}
          >
            <Sparkles color={theme.colors.gold} size={11} strokeWidth={1.8} />
            <Text style={styles.symbolStatText}>
              {s.label} · {s.count}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {symbolStats.length > 0 ? (
        <GlassCard
          borderColor={theme.colors.borderPurple}
          intensity={18}
          surfaceColor="rgba(98,82,142,0.14)"
          overlayColor="rgba(116,95,168,0.1)"
          style={styles.insightCard}
        >
          <View style={styles.insightMoon}>
            <LinearGradient
              colors={["rgba(157,124,230,0.45)", "rgba(35,31,58,0.9)"]}
              style={StyleSheet.absoluteFill}
            />
            <Moon color={theme.colors.gold} size={22} strokeWidth={1.5} />
          </View>
          <View style={styles.insightCopy}>
            <Text style={styles.insightLine}>
              Чаще всего вам снятся:{" "}
              <Text style={styles.insightHighlight}>{symbolStats[0]?.label}</Text>
              {symbolStats[1] ? " и " : ""}
              {symbolStats[1] ? (
                <Text style={styles.insightHighlight}>{symbolStats[1]?.label}</Text>
              ) : null}
            </Text>
            <Text style={styles.insightSub}>
              Эти символы встречались {symbolStats[0]?.count ?? 0}
              {"+"} раз в ваших последних толкованиях
            </Text>
          </View>
          <View style={styles.insightDecor} pointerEvents="none">
            <View style={{ opacity: 0.28 }}>
              <Sparkles color={theme.colors.mauve} size={14} strokeWidth={1.4} />
            </View>
          </View>
        </GlassCard>
      ) : null}

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
                  colors={[...theme.gradients.primaryCta]}
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
        const { Icon, tint } = dreamIcon(d.id);
        const isFav = favorites[d.id];
        return (
          <GlassCard
            key={d.id}
            borderColor={theme.colors.border}
            intensity={20}
            surfaceColor="rgba(35,31,58,0.42)"
            style={styles.dreamCard}
          >
            <View style={styles.dreamCardRow}>
              <View style={[styles.dreamIconWrap, { borderColor: tint + "66" }]}>
                <LinearGradient
                  colors={[`${tint}30`, "rgba(18,16,34,0.75)"]}
                  style={StyleSheet.absoluteFill}
                />
                <Icon color={tint} size={24} strokeWidth={1.35} />
              </View>
              <View style={styles.dreamCardMain}>
                <View style={styles.dreamTitleRow}>
                  <Text style={styles.dreamTitle} numberOfLines={2}>
                    {d.title}
                  </Text>
                  <Text style={styles.dreamDate}>{d.date}</Text>
                </View>
                <Text style={styles.dreamSnippet} numberOfLines={2}>
                  {d.snippet}
                </Text>
                <View style={styles.dreamFooter}>
                  <View style={styles.dreamTags}>
                    {d.tags.map((t) => (
                      <View key={t} style={styles.tagChip}>
                        <Text style={styles.tagChipText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                  <Pressable
                    hitSlop={10}
                    onPress={() => toggleFavorite(d.id)}
                    style={styles.starBtn}
                  >
                    <Star
                      color={isFav ? theme.colors.gold : theme.colors.textDim}
                      size={20}
                      strokeWidth={1.65}
                      fill={isFav ? theme.colors.gold : "none"}
                    />
                  </Pressable>
                </View>
              </View>
            </View>
          </GlassCard>
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
      <CosmicBackground />
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

  popularHead: {
    marginTop: 2,
    marginBottom: 10,
  },
  popularHeadText: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10.5,
    letterSpacing: 2.2,
    color: theme.colors.gold,
  },
  symbolChipsRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 18,
    paddingRight: 8,
  },
  symbolStatChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(246,240,255,0.06)",
  },
  symbolStatText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: theme.colors.textDim,
  },

  insightCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginTop: 4,
    marginBottom: 14,
    gap: 12,
    overflow: "hidden",
  },
  insightMoon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
  },
  insightCopy: {
    flex: 1,
    minWidth: 0,
  },
  insightLine: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.text,
  },
  insightHighlight: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
  },
  insightSub: {
    marginTop: 6,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textMuted,
  },
  insightDecor: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    paddingLeft: 4,
  },

  filterWrap: {
    marginBottom: 14,
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
    borderColor: theme.colors.border,
    backgroundColor: "rgba(26,23,43,0.65)",
    overflow: "hidden",
  },
  filterPillActive: {
    borderColor: theme.colors.borderGold,
  },
  filterPillText: {
    zIndex: 1,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 0.3,
    color: theme.colors.textDim,
  },
  filterPillTextActive: {
    color: "#FFF7EA",
  },

  dreamCard: {
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: theme.radius.lg,
  },
  dreamCardRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  dreamIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  dreamCardMain: {
    flex: 1,
    minWidth: 0,
  },
  dreamTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 6,
  },
  dreamTitle: {
    flex: 1,
    fontFamily: theme.fonts.heading,
    fontSize: 16,
    lineHeight: 21,
    color: theme.colors.text,
  },
  dreamDate: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  dreamSnippet: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textDim,
  },
  dreamFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 10,
  },
  dreamTags: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(35,31,58,0.85)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tagChipText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 10,
    color: theme.colors.lilac,
  },
  starBtn: {
    padding: 4,
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
