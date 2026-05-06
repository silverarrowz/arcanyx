import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Moon, Sparkles, X } from "lucide-react-native";
import { theme } from "../src/theme";
import CosmicBackground from "../src/components/CosmicBackground";
import GlassCard from "../src/components/GlassCard";
import { useHistory } from "../src/context/HistoryContext";

const HEADER_IMAGE = require("../assets/home/chrome-dreams.png");

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function DreamResultScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { items } = useHistory();

  const dream = useMemo(() => {
    const byId = typeof id === "string" ? items.find((it) => it.id === id) : null;
    if (byId?.type === "dream") return byId;
    return items.find((it) => it.type === "dream") ?? null;
  }, [id, items]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/dreambook");
  };

  return (
    <View style={styles.root}>
      <CosmicBackground />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} hitSlop={10} style={styles.closeBtn}>
            <X color={theme.colors.text} size={20} strokeWidth={1.8} />
          </Pressable>
        </View>

        {!dream ? (
          <View style={styles.emptyWrap}>
            <Moon color={theme.colors.textMuted} size={28} strokeWidth={1.6} />
            <Text style={styles.emptyTitle}>Толкование не найдено</Text>
            <Text style={styles.emptyText}>
              Вернитесь в Сонник и получите новое толкование сна.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <GlassCard
              borderColor={theme.colors.borderPurple}
              glow="purple"
              intensity={20}
              surfaceColor="rgba(98,82,142,0.16)"
              overlayColor="rgba(116,95,168,0.14)"
              style={styles.heroCard}
            >
              <Image source={HEADER_IMAGE} style={styles.heroImage} contentFit="cover" />
              <LinearGradient
                colors={["rgba(16,14,30,0.52)", "rgba(16,14,30,0.92)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.heroContent}>
                <View style={styles.heroEyebrow}>
                  <Sparkles color={theme.colors.gold} size={12} strokeWidth={1.8} />
                  <Text style={styles.heroEyebrowText}>ЗНАЧЕНИЕ ВАШЕГО СНА</Text>
                </View>
                <Text style={styles.title}>{dream.answer}</Text>
                {dream.date ? <Text style={styles.date}>{formatDate(dream.date)}</Text> : null}
              </View>
            </GlassCard>

            <GlassCard
              borderColor={theme.colors.border}
              intensity={16}
              surfaceColor="rgba(35,31,58,0.52)"
              style={styles.block}
            >
              <View style={styles.blockInner}>
                <Text style={styles.blockTitle}>Ваш сон</Text>
                <Text style={styles.bodyText}>
                  {dream.dreamText?.trim() || "Текст сна недоступен для этой записи."}
                </Text>
              </View>
            </GlassCard>

            <GlassCard
              borderColor={theme.colors.border}
              intensity={16}
              surfaceColor="rgba(35,31,58,0.52)"
              style={styles.block}
            >
              <View style={styles.blockInner}>
                <Text style={styles.blockTitle}>Расшифровка</Text>
                <Text style={styles.bodyText}>{dream.dreamInterpretation ?? dream.answer}</Text>
              </View>
            </GlassCard>

            {dream.dreamSymbols && dream.dreamSymbols.length > 0 ? (
              <GlassCard
                borderColor={theme.colors.border}
                intensity={16}
                surfaceColor="rgba(35,31,58,0.52)"
                style={styles.block}
              >
                <View style={styles.blockInner}>
                  <Text style={styles.blockTitle}>Ключевые символы</Text>
                  <View style={styles.chipsWrap}>
                    {dream.dreamSymbols.map((symbol) => (
                      <View key={symbol} style={styles.chip}>
                        <Text style={styles.chipText}>{symbol}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </GlassCard>
            ) : null}

            {dream.dreamAdvice ? (
              <GlassCard
                borderColor={theme.colors.borderPurple}
                glow="purple"
                intensity={16}
                surfaceColor="rgba(98,82,142,0.16)"
                overlayColor="rgba(116,95,168,0.12)"
                style={styles.block}
              >
                <View style={styles.blockInner}>
                  <Text style={styles.blockTitle}>Подсказка</Text>
                  <Text style={styles.bodyText}>{dream.dreamAdvice}</Text>
                </View>
              </GlassCard>
            ) : null}

            <View style={{ height: 36 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 16,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(35,31,58,0.65)",
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 14,
  },
  heroCard: {
    minHeight: 220,
    overflow: "hidden",
    marginBottom: 14,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.95,
  },
  heroContent: {
    padding: 24,
    minHeight: 220,
    justifyContent: "flex-end",
  },
  heroEyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  heroEyebrowText: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10.5,
    letterSpacing: 1.8,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 30,
    lineHeight: 34,
  },
  date: {
    marginTop: 8,
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
  },
  block: {
    marginTop: 12,
  },
  blockInner: {
    padding: 24
  },
  blockTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 15,
    marginBottom: 8,
  },
  bodyText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(246,240,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    color: theme.colors.lilac,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
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
    lineHeight: 19,
    textAlign: "center",
  },
});
