import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bird,
  BookOpen,
  ChevronRight,
  DoorOpen,
  Heart,
  History,
  Layers,
  Moon,
  Sparkles,
  UserRound,
  Waves,
} from "lucide-react-native";
import { theme } from "../../src/theme";
import CosmicBackground from "../../src/components/CosmicBackground";
import GlassCard from "../../src/components/GlassCard";
import DreamHistoryScreen from "../../src/screens/DreamHistoryScreen";
import { useRemountOnTabFocus } from "../../src/hooks/useRemountOnTabFocus";

const CARD_BG = require("../../assets/home/bg-dream.png");
const RECENT_THUMB = require("../../assets/home/qr-dreams.png");
const MAX_DREAM_LEN = 1500;
/** Высота многострочного поля (скролл внутри); карточка с фоном не меняет высоту */
const DREAM_INPUT_BOX_H = 168;

const THEME_CHIPS = [
  "падение",
  "полет",
  "вода",
  "зубы",
  "погоня",
  "дом",
  "...",
] as const;

const POPULAR_SYMBOLS: {
  key: string;
  title: string;
  subtitle: string;
  Icon: React.ComponentType<{ color: string; size: number; strokeWidth?: number }>;
  tint: string;
}[] = [
  {
    key: "doors",
    title: "Двери",
    subtitle: "Возможности",
    Icon: DoorOpen,
    tint: "#C47BEA",
  },
  {
    key: "stairs",
    title: "Лестницы",
    subtitle: "Рост и путь",
    Icon: Layers,
    tint: "#9D7CE6",
  },
  {
    key: "water",
    title: "Вода",
    subtitle: "Эмоции",
    Icon: Waves,
    tint: "#61A5FA",
  },
  {
    key: "bird",
    title: "Птицы",
    subtitle: "Послание",
    Icon: Bird,
    tint: "#FDA4AF",
  },
  {
    key: "silhouette",
    title: "Тень",
    subtitle: "Скрытое",
    Icon: UserRound,
    tint: "#94A3B8",
  },
  {
    key: "heart",
    title: "Сердце",
    subtitle: "Близость",
    Icon: Heart,
    tint: "#EFA0C0",
  },
];

const MOCK_RECENT = [
  {
    key: "1",
    title: "Сон о полёте над городом",
    snippet: "Вы летели над огнями города, чувствуя легкость и радость…",
    date: "18 мая 2026",
    tag: "Свобода",
  },
];

const H_PAD = 24;
const SYMBOL_GAP = 10;

type DreamBookTab = "interpret" | "history";

export default function DreamBookScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { width: windowWidth } = useWindowDimensions();
  const [text, setText] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const [active, setActive] = useState<DreamBookTab>(() =>
    tab === "history" ? "history" : "interpret",
  );
  const remountKey = useRemountOnTabFocus();

  useEffect(() => {
    if (tab === "history") setActive("history");
    else if (tab === "interpret") setActive("interpret");
  }, [tab]);

  const selectTab = useCallback(
    (t: DreamBookTab) => {
      if (t === active) return;
      Haptics.selectionAsync().catch(() => {});
      setActive(t);
      router.setParams({ tab: t });
    },
    [active, router],
  );

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  const insertChip = useCallback((chip: string) => {
    if (chip === "...") return;
    setText((prev) => {
      const t = prev.trim();
      if (!t) return chip;
      return `${t}${t.endsWith(" ") ? "" : " "}${chip}`;
    });
  }, []);

  const trimmedLen = text.length;
  const ctaDisabled = trimmedLen === 0;

  const symbolColW = Math.floor(
    (windowWidth - H_PAD * 2 - SYMBOL_GAP) / 2,
  );

  return (
    <View style={styles.root} testID="dreambook-root">
      <CosmicBackground />
      <SafeAreaView style={styles.segmentSafe} edges={["top"]}>
        <View style={styles.segmentPill}>
          <Pressable
            onPress={() => selectTab("interpret")}
            style={({ pressed }) => [
              styles.segOption,
              active === "interpret" && styles.segOptionActive,
              pressed && { opacity: 0.92 },
            ]}
            testID="dreambook-tab-interpret"
          >
            {active === "interpret" ? (
              <LinearGradient
                colors={["rgba(239,160,192,0.45)", "rgba(157,124,230,0.28)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <BookOpen
              color={active === "interpret" ? theme.colors.text : theme.colors.textDim}
              size={17}
              strokeWidth={active === "interpret" ? 2 : 1.6}
            />
            <Text
              style={[styles.segText, active === "interpret" && styles.segTextActive]}
            >
              Сонник
            </Text>
          </Pressable>
          <Pressable
            onPress={() => selectTab("history")}
            style={({ pressed }) => [
              styles.segOption,
              active === "history" && styles.segOptionActive,
              pressed && { opacity: 0.92 },
            ]}
            testID="dreambook-tab-history"
          >
            {active === "history" ? (
              <LinearGradient
                colors={["rgba(239,160,192,0.45)", "rgba(157,124,230,0.28)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <History
              color={active === "history" ? theme.colors.text : theme.colors.textDim}
              size={17}
              strokeWidth={active === "history" ? 2 : 1.6}
            />
            <Text style={[styles.segText, active === "history" && styles.segTextActive]}>
              История снов
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <View style={styles.tabContent}>
        {active === "history" ? (
          <DreamHistoryScreen key={`dream-history-${remountKey}`} embedded />
        ) : (
          <SafeAreaView style={styles.safe} edges={["bottom"]}>
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <ScrollView
                ref={scrollRef}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets
                nestedScrollEnabled
              >
            {/* Заголовок — как Оракул / Таро: центр, ✦, display, подзаголовок */}
            <View style={styles.heroCopy}>
              <View style={styles.heroDivider}>
                <View style={styles.heroDividerLine} />
                <Text style={styles.heroDividerStar}>✦</Text>
                <View style={styles.heroDividerLine} />
              </View>
              <Text style={styles.title}>Сонник</Text>
              <Text style={styles.subtitle}>
                Опишите свой сон — поможем раскрыть его тайный смысл.
              </Text>
            </View>

            <View style={styles.contentWrap}>
              {/* Карточка ввода — тот же приём, что блок снов на главной */}
              <GlassCard
                borderColor={theme.colors.borderPurple}
                glow="purple"
                intensity={14}
                surfaceColor="rgba(98,82,142,0.2)"
                overlayColor="rgba(116,95,168,0.16)"
                style={styles.mainCard}
              >
                <Image
                  source={CARD_BG}
                  style={styles.cardBgImage}
                  contentFit="cover"
                  contentPosition="left center"
                />
                <LinearGradient
                  colors={[
                    "rgba(24,22,40,0.94)",
                    "rgba(24,22,40,0.78)",
                    "rgba(24,22,40,0.52)",
                    "rgba(24,22,40,0.35)",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  locations={[0, 0.28, 0.58, 1]}
                  style={StyleSheet.absoluteFill}
                />

                <View style={styles.mainCardInner}>
                  <View style={styles.inputHead}>
                    <View style={styles.eyebrowRow}>
                      <Moon color={theme.colors.gold} size={14} strokeWidth={1.7} />
                      <Text style={styles.sectionEyebrow}>ЧТО ВАМ ПРИСНИЛОСЬ?</Text>
                    </View>
                  
                  </View>

                  <GlassCard
                    glow="purple"
                    borderColor={theme.colors.borderPurple}
                    intensity={18}
                    surfaceColor="rgba(98,82,142,0.22)"
                    overlayColor="rgba(116,95,168,0.18)"
                    style={styles.inputCard}
                  >
                    <TextInput
                      value={text}
                      onChangeText={setText}
                      placeholder="Расскажите подробно: кто был рядом, что происходило, какие чувства остались после пробуждения."
                      placeholderTextColor={theme.colors.textDim}
                      multiline
                      scrollEnabled
                      textAlignVertical="top"
                      maxLength={MAX_DREAM_LEN}
                      style={styles.dreamInput}
                      underlineColorAndroid="transparent"
                    />
                    <View style={styles.inputSparkle} pointerEvents="none">
                      <Sparkles
                        color="rgba(255,215,154,0.45)"
                        size={14}
                        strokeWidth={1.4}
                      />
                    </View>
                  </GlassCard>

                  <Pressable
                    disabled={ctaDisabled}
                    style={[styles.ctaWrap, ctaDisabled && styles.ctaWrapDisabled]}
                    onPress={() => {
                      /* толкование позже */
                    }}
                  >
                    <LinearGradient
                      colors={
                        ctaDisabled
                          ? [...theme.gradients.primaryCtaMuted]
                          : [...theme.gradients.primaryCta]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.ctaGrad}
                    >
                      <Sparkles
                        color={ctaDisabled ? "#C9BED6" : "#FFF7EA"}
                        size={15}
                        strokeWidth={1.7}
                      />
                      <Text style={[styles.ctaLabel, ctaDisabled && styles.ctaLabelMuted]}>
                        Получить толкование
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </GlassCard>

              <Text style={styles.sectionLabel}>Попробуйте темы</Text>
              <GlassCard
                borderColor={theme.colors.borderPurple}
                intensity={20}
                surfaceColor="rgba(98,82,142,0.12)"
                overlayColor="rgba(116,95,168,0.1)"
                style={styles.themesCard}
              >
                <View style={styles.chipsWrap}>
                  {THEME_CHIPS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => insertChip(c)}
                      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.88 }]}
                    >
                      <Sparkles color={theme.colors.gold} size={10} strokeWidth={1.8} />
                      <Text style={styles.chipText}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
              </GlassCard>

              <View style={styles.sectionHeadBetween}>
                <Text style={styles.sectionLabelTight}>Популярные символы во снах</Text>
                <Pressable hitSlop={8} style={styles.seeAllPress}>
                  <Text style={styles.seeLink}>Смотреть все</Text>
                  <ChevronRight color={theme.colors.gold} size={14} strokeWidth={2} />
                </Pressable>
              </View>
              <GlassCard
                borderColor={theme.colors.borderPurple}
                glow="purple"
                intensity={18}
                surfaceColor="rgba(98,82,142,0.14)"
                overlayColor="rgba(116,95,168,0.12)"
                style={styles.symbolsPanel}
              >
                <View style={styles.symbolsGrid}>
                  {POPULAR_SYMBOLS.map((sym) => (
                    <Pressable
                      key={sym.key}
                      style={({ pressed }) => [
                        styles.symbolTile,
                        { width: symbolColW },
                        pressed && { opacity: 0.9 },
                      ]}
                    >
                      <View
                        style={[
                          styles.symbolTileInner,
                          { borderColor: sym.tint + "4D" },
                        ]}
                      >
                        <LinearGradient
                          colors={[
                            `${sym.tint}35`,
                            `${sym.tint}12`,
                            "rgba(18,16,34,0.4)",
                          ]}
                          start={{ x: 0.2, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                        <sym.Icon color={sym.tint} size={28} strokeWidth={1.35} />
                      </View>
                      <Text style={styles.symTitle}>{sym.title}</Text>
                      <Text style={styles.symSub}>{sym.subtitle}</Text>
                    </Pressable>
                  ))}
                </View>
              </GlassCard>

              <View style={styles.sectionHeadBetween}>
                <Text style={styles.sectionLabelTight}>Недавние толкования</Text>
                <Pressable hitSlop={8} style={styles.seeAllPress}>
                  <Text style={styles.seeLink}>Смотреть все</Text>
                  <ChevronRight color={theme.colors.gold} size={14} strokeWidth={2} />
                </Pressable>
              </View>

              <GlassCard
                borderColor={theme.colors.borderPurple}
                intensity={18}
                surfaceColor="rgba(98,82,142,0.1)"
                overlayColor="rgba(116,95,168,0.08)"
                style={styles.recentPanel}
              >
                {MOCK_RECENT.map((it, idx) => (
                  <Pressable
                    key={it.key}
                    style={[
                      styles.recentRow,
                      idx < MOCK_RECENT.length - 1 && styles.recentRowBorder,
                    ]}
                  >
                    <Image source={RECENT_THUMB} style={styles.recentThumb} contentFit="cover" />
                    <View style={styles.recentBody}>
                      <Text style={styles.recentTitle}>{it.title}</Text>
                      <Text style={styles.recentSnippet} numberOfLines={2}>
                        {it.snippet}
                      </Text>
                      <View style={styles.recentMeta}>
                        <Text style={styles.recentDate}>{it.date}</Text>
                        <View style={styles.recentTag}>
                          <Sparkles color={theme.colors.gold} size={10} strokeWidth={1.7} />
                          <Text style={styles.recentTagText}>{it.tag}</Text>
                        </View>
                      </View>
                    </View>
                    <ChevronRight color={theme.colors.textDim} size={20} strokeWidth={1.8} />
                  </Pressable>
                ))}
              </GlassCard>

              <View style={{ height: 120 }} />
            </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  segmentSafe: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  segmentPill: {
    flexDirection: "row",
    alignSelf: "stretch",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: "rgba(26,23,43,0.88)",
    padding: 4,
    gap: 4,
  },
  segOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 999,
    overflow: "hidden",
    minWidth: 0,
  },
  segOptionActive: {
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
  },
  segText: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 0.25,
    color: theme.colors.textDim,
  },
  segTextActive: {
    color: theme.colors.text,
  },
  tabContent: {
    flex: 1,
  },
  safe: { flex: 1 },
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingBottom: 24,
  },

  /** Как TarotScreen / OracleScreen — heroCopy */
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
    maxWidth: 280,
  },

  contentWrap: {
    paddingHorizontal: 0,
  },

  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 10,
  },

  mainCard: {
    marginBottom: 22,
    overflow: "hidden",
  },
  cardBgImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.88,
  },
  mainCardInner: {
    padding: 20,
    width: "100%",
  },
  inputHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  sectionEyebrow: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10.5,
    letterSpacing: 2.4,
    flexShrink: 1,
  },
  counter: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    flexShrink: 0,
  },

  inputCard: {
    alignSelf: "stretch",
    borderRadius: 22,
    position: "relative",
    overflow: "hidden",
    /** Фиксированная высота блока ввода — карточка и фон не тянутся с ростом текста */
    maxHeight: DREAM_INPUT_BOX_H,
  },
  dreamInput: {
    width: "100%",
    height: DREAM_INPUT_BOX_H,
    maxHeight: DREAM_INPUT_BOX_H,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingRight: 36,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.text,
  },
  inputSparkle: {
    position: "absolute",
    top: 12,
    right: 12,
  },

  ctaWrap: {
    marginTop: 18,
    borderRadius: 999,
    alignSelf: "stretch",
    overflow: "hidden",
    ...theme.shadows.ctaPrimary,
  },
  ctaWrapDisabled: {
    ...theme.shadows.ctaMuted,
  },
  ctaGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 999,
  },
  ctaLabel: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 15,
    letterSpacing: 0.35,
    color: "#FFF7EA",
  },
  ctaLabelMuted: { color: "#D8CFDF" },

  /** Как OracleScreen.sourceTitle */
  sectionLabel: {
    color: theme.colors.lilac,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 10,
  },
  sectionHeadBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 22,
    marginBottom: 10,
    gap: 12,
  },
  sectionLabelTight: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
    color: theme.colors.lilac,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },

  themesCard: {
    marginBottom: 6,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(246,240,255,0.06)",
  },
  chipText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: theme.colors.textDim,
  },

  seeLink: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
  },
  seeAllPress: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },

  symbolsPanel: {
    marginBottom: 4,
    overflow: "hidden",
  },
  symbolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SYMBOL_GAP,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
  },
  symbolTile: {
    marginBottom: 4,
  },
  symbolTileInner: {
    width: "100%",
    aspectRatio: 1.05,
    borderRadius: 20,
    marginBottom: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: "rgba(18,16,34,0.45)",
  },
  symTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: 15,
    color: theme.colors.text,
    marginBottom: 3,
  },
  symSub: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 16,
  },

  recentPanel: {
    overflow: "hidden",
    paddingVertical: 4,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  recentRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  recentBody: { flex: 1, minWidth: 0 },
  recentThumb: {
    width: 58,
    height: 58,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
  },
  recentTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: 15,
    color: theme.colors.text,
    marginBottom: 4,
  },
  recentSnippet: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.textDim,
    marginBottom: 8,
  },
  recentMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  recentDate: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  recentTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    backgroundColor: "rgba(255,215,154,0.06)",
  },
  recentTagText: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 9,
    letterSpacing: 1.2,
    color: theme.colors.gold,
  },
});
