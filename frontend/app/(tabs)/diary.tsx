import React, { useMemo } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CheckCircle2,
  XCircle,
  Eye,
  Layers,
  BookOpen,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, Layout } from "react-native-reanimated";
import { theme } from "../../src/theme";
import CosmicBackground from "../../src/components/CosmicBackground";
import GlassCard from "../../src/components/GlassCard";
import { HistoryItem, useHistory } from "../../src/context/HistoryContext";
import { CATEGORY_META } from "../../src/data/oracleAnswers";

function formatDate(iso: string): string {
  const d = new Date(iso);
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

  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
  }) + ` · ${time}`;
}

function DiaryRow({ item }: { item: HistoryItem }) {
  const { setOutcome } = useHistory();

  const isOracle = item.type === "oracle";
  const meta =
    isOracle && item.category
      ? CATEGORY_META[item.category as keyof typeof CATEGORY_META]
      : null;

  const handleOutcome = (outcome: "fulfilled" | "failed") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // toggle off if already same
    setOutcome(item.id, item.outcome === outcome ? null : outcome);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(350)}
      layout={Layout.springify()}
      style={styles.rowWrap}
    >
      <GlassCard
        borderColor={
          isOracle ? theme.colors.borderPurple : theme.colors.borderGold
        }
        style={styles.row}
      >
        <View style={styles.rowInner}>
          <View style={styles.rowHeader}>
            <View
              style={[
                styles.typeBadge,
                {
                  borderColor: isOracle
                    ? theme.colors.purple
                    : theme.colors.gold,
                  backgroundColor: isOracle
                    ? "rgba(157,78,221,0.15)"
                    : "rgba(212,175,55,0.15)",
                },
              ]}
            >
              {isOracle ? (
                <Eye color={theme.colors.purple} size={12} />
              ) : (
                <Layers color={theme.colors.gold} size={12} />
              )}
              <Text
                style={[
                  styles.typeText,
                  {
                    color: isOracle ? theme.colors.purple : theme.colors.gold,
                  },
                ]}
              >
                {isOracle ? "Оракул" : "Таро"}
              </Text>
            </View>
            <Text style={styles.dateText}>{formatDate(item.date)}</Text>
          </View>

          <Text style={styles.question} numberOfLines={2}>
            {item.question}
          </Text>
          <Text style={styles.answer}>«{item.answer}»</Text>

          {meta && (
            <View style={styles.metaRow}>
              <View
                style={[
                  styles.metaDot,
                  { backgroundColor: meta.color },
                ]}
              />
              <Text style={[styles.metaText, { color: meta.color }]}>
                {meta.label}
              </Text>
            </View>
          )}

          {isOracle && (
            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => handleOutcome("fulfilled")}
                testID={`outcome-fulfilled-${item.id}`}
                style={[
                  styles.actionBtn,
                  item.outcome === "fulfilled" && styles.actionBtnActiveGreen,
                ]}
              >
                <CheckCircle2
                  color={
                    item.outcome === "fulfilled"
                      ? theme.colors.success
                      : theme.colors.textDim
                  }
                  size={16}
                />
                <Text
                  style={[
                    styles.actionText,
                    item.outcome === "fulfilled" && {
                      color: theme.colors.success,
                    },
                  ]}
                >
                  Сбылось
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleOutcome("failed")}
                testID={`outcome-failed-${item.id}`}
                style={[
                  styles.actionBtn,
                  item.outcome === "failed" && styles.actionBtnActiveRed,
                ]}
              >
                <XCircle
                  color={
                    item.outcome === "failed"
                      ? theme.colors.danger
                      : theme.colors.textDim
                  }
                  size={16}
                />
                <Text
                  style={[
                    styles.actionText,
                    item.outcome === "failed" && {
                      color: theme.colors.danger,
                    },
                  ]}
                >
                  Не сбылось
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </GlassCard>
    </Animated.View>
  );
}

export default function DiaryScreen() {
  const { items } = useHistory();

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [items],
  );

  return (
    <View style={styles.root}>
      <CosmicBackground />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ДНЕВНИК</Text>
          <Text style={styles.title}>Дневник Судьбы</Text>
          <Text style={styles.subtitle}>
            История твоих вопросов и знаков Вселенной
          </Text>
        </View>

        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <DiaryRow item={item} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <BookOpen color={theme.colors.textDim} size={36} />
              <Text style={styles.emptyTitle}>Дневник пока пуст</Text>
              <Text style={styles.emptyText}>
                Задай вопрос Оракулу или вытяни карту Таро —{"\n"}и они появятся
                здесь.
              </Text>
            </View>
          }
          testID="diary-list"
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    marginBottom: 16,
  },
  eyebrow: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 3,
    color: theme.colors.textDim,
    marginBottom: 6,
    marginTop: 8,
  },
  title: {
    fontFamily: theme.fonts.headingBold,
    color: theme.colors.text,
    fontSize: 30,
  },
  subtitle: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 140,
    gap: 14,
  },
  rowWrap: {},
  row: {},
  rowInner: { padding: 18 },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  typeText: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  dateText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  question: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 15,
    marginBottom: 6,
  },
  answer: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontStyle: "italic",
    fontSize: 17,
    lineHeight: 23,
    marginBottom: 8,
    opacity: 0.92,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  metaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  metaText: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  actionBtnActiveGreen: {
    borderColor: "rgba(16,185,129,0.5)",
    backgroundColor: "rgba(16,185,129,0.12)",
  },
  actionBtnActiveRed: {
    borderColor: "rgba(239,68,68,0.5)",
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  actionText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.headingBold,
    fontSize: 20,
    marginTop: 6,
  },
  emptyText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
});
