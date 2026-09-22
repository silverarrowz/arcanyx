import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Moon, Sparkles, X } from "lucide-react-native";
import { theme } from "../src/theme";
import CosmicBackground from "../src/components/CosmicBackground";
import { useHistory } from "../src/context/HistoryContext";

const HEADER_IMAGE = require("../assets/home/chrome-dreams.jpg");
/** Matches the dream backdrop where the hero ends, so the image melts into the page. */
const HERO_FADE = "#1A1636";

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
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { items } = useHistory();

  const dream = useMemo(() => {
    const byId = typeof id === "string" ? items.find((it) => it.id === id) : null;
    if (byId?.type === "dream") return byId;
    return items.find((it) => it.type === "dream") ?? null;
  }, [id, items]);
  const [heroFailed, setHeroFailed] = useState(false);

  useEffect(() => {
    setHeroFailed(false);
  }, [dream?.id, dream?.dreamImageUrl]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/dreambook");
  };

  const generatedHero = Boolean(dream?.dreamImageUrl) && !heroFailed;
  const heroSource =
    generatedHero && dream?.dreamImageUrl
      ? { uri: dream.dreamImageUrl }
      : HEADER_IMAGE;
  const imagePending = dream?.dreamImageStatus === "pending" && !generatedHero;

  return (
    <View style={styles.root}>
      <CosmicBackground variant="dream" />
      {/* The hero art bleeds to the top edge, so the close button floats above it. */}
      <SafeAreaView style={styles.safe} edges={dream ? ["bottom"] : ["top", "bottom"]}>
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
            <View style={styles.hero}>
              <Image
                source={heroSource}
                style={styles.heroImage}
                contentFit="cover"
                onError={() => setHeroFailed(true)}
              />
              <LinearGradient
                colors={[
                  "rgba(26,22,54,0.28)",
                  "rgba(26,22,54,0.82)",
                  HERO_FADE,
                ]}
                locations={[0, 0.62, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {imagePending ? (
                <View
                  style={[styles.heroPending, { top: insets.top + 16 }]}
                  pointerEvents="none"
                >
                  <ActivityIndicator color={theme.colors.gold} size="small" />
                  <Text style={styles.heroPendingText}>Создаём иллюстрацию сна</Text>
                </View>
              ) : null}
              <View style={[styles.heroContent, { paddingTop: insets.top + 24 }]}>
                <View style={styles.heroEyebrow}>
                  <Sparkles color={theme.colors.gold} size={12} strokeWidth={1.8} />
                  <Text style={styles.heroEyebrowText}>ЗНАЧЕНИЕ ВАШЕГО СНА</Text>
                </View>
                <Text style={styles.title}>{dream.answer}</Text>
                {dream.date ? <Text style={styles.date}>{formatDate(dream.date)}</Text> : null}
              </View>
            </View>

            <View style={styles.body}>
              <Text style={styles.sectionTitle}>Ваш сон</Text>
              <Text style={styles.bodyText}>
                {dream.dreamText?.trim() || "Текст сна недоступен для этой записи."}
              </Text>

              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>Расшифровка</Text>
              <Text style={styles.bodyText}>
                {dream.dreamInterpretation ?? dream.answer}
              </Text>

              {dream.dreamSymbols && dream.dreamSymbols.length > 0 ? (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.sectionTitle}>Ключевые символы</Text>
                  <View style={styles.chipsWrap}>
                    {dream.dreamSymbols.map((symbol) => (
                      <View key={symbol} style={styles.chip}>
                        <Text style={styles.chipText}>{symbol}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

              {dream.dreamAdvice ? (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.sectionTitle}>Совет</Text>
                  <Text style={styles.bodyText}>{dream.dreamAdvice}</Text>
                </>
              ) : null}
            </View>

            <View style={{ height: 36 }} />
          </ScrollView>
        )}
      </SafeAreaView>

      <Pressable
        onPress={handleBack}
        hitSlop={10}
        style={[styles.closeBtn, { top: insets.top + 10 }]}
      >
        <X color={theme.colors.text} size={20} strokeWidth={1.8} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  closeBtn: {
    position: "absolute",
    right: 18,
    zIndex: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20,17,42,0.55)",
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  scroll: {
    paddingBottom: 14,
  },
  /** Full-bleed illustration that fades into the backdrop instead of sitting in a card. */
  hero: {
    minHeight: 340,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.95,
  },
  heroPending: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(16,14,30,0.55)",
  },
  heroPendingText: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  heroContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 26,
  },
  heroEyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  heroEyebrowText: {
    color: theme.colors.archive.label,
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
  body: {
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  sectionTitle: {
    color: theme.colors.archive.headline,
    fontFamily: theme.fonts.editorialItalic,
    fontStyle: theme.editorialItalicStyle,
    fontSize: 21,
    marginBottom: 10,
  },
  bodyText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.94,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,247,234,0.12)",
    marginVertical: 26,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    backgroundColor: "rgba(246,240,255,0.09)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    color: theme.colors.lilac,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
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
