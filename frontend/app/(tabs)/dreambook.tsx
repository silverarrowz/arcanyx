import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter, useScrollToTop } from "expo-router";
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
  ArrowRight,
  Bird,
  BookOpen,
  DoorOpen,
  Heart,
  History,
  Layers,
  Mic,
  MicOff,
  Moon,
  Sparkles,
  UserRound,
  Waves,
} from "lucide-react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { theme } from "../../src/theme";
import CosmicBackground from "../../src/components/CosmicBackground";
import GlassCard from "../../src/components/GlassCard";
import ScreenHeading from "../../src/components/ScreenHeading";
import DreamHistoryScreen from "../../src/screens/DreamHistoryScreen";
import DreamInterpretLoadingScreen from "../../src/screens/DreamInterpretLoadingScreen";
import { useRemountOnTabFocus } from "../../src/hooks/useRemountOnTabFocus";
import { useHistory } from "../../src/context/HistoryContext";
import { useDreamDictation } from "../../src/hooks/useDreamDictation";
import {
  DREAM_TEXT_MAX_LENGTH,
  applyDreamIllustration,
  interpretDream,
  startDreamIllustration,
} from "../../src/services/dreamInterpretation";

const CARD_BG = require("../../assets/home/bg-main-bottom.jpg");
/** Высота многострочного поля (скролл внутри); карточка с фоном не меняет высоту */
const DREAM_INPUT_BOX_H = 168;

const RECENT_LIMIT = 3;
const H_PAD = 24;

function formatRecentDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type DreamBookTab = "interpret" | "history";

export default function DreamBookScreen() {
  const router = useRouter();
  const { addItem, items, updateItem } = useHistory();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { width: windowWidth } = useWindowDimensions();
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const [active, setActive] = useState<DreamBookTab>(() =>
    tab === "history" ? "history" : "interpret",
  );
  const remountKey = useRemountOnTabFocus();

  const recentDreams = useMemo(
    () =>
      items
        .filter((item) => item.type === "dream")
        .slice(0, RECENT_LIMIT)
        .map((item) => ({
          id: item.id,
          title: item.answer || "Толкование сна",
        snippet: item.dreamInterpretation ?? item.dreamText ?? item.answer,
        date: formatRecentDate(item.date),
        tag: item.dreamSymbols?.[0],
        imageUrl: item.dreamImageUrl,
        })),
    [items],
  );

  const appendDictatedText = useCallback((dictated: string) => {
    setText((prev) => {
      const trimmedPrev = prev.trimEnd();
      const trimmedNew = dictated.trim();
      if (!trimmedNew) return prev;
      if (!trimmedPrev) return trimmedNew;
      const needsSpace = !/[\s.,;:!?…—-]$/.test(trimmedPrev);
      return `${trimmedPrev}${needsSpace ? " " : ""}${trimmedNew}`;
    });
  }, []);

  const dictation = useDreamDictation({
    onFinalTranscript: appendDictatedText,
  });

  const onPressMic = useCallback(async () => {
    Haptics.selectionAsync().catch(() => {});
    await dictation.toggle();
  }, [dictation]);

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (dictation.isListening) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 180 });
    }
  }, [dictation.isListening, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + pulse.value * 0.55,
    transform: [{ scale: 0.9 + pulse.value * 0.35 }],
  }));

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

  const trimmedLen = text.trim().length;
  const ctaDisabled = trimmedLen === 0 || isLoading;

  const handleInterpret = useCallback(async () => {
    const dreamText = text.trim();
    if (!dreamText || isLoading) return;

    setError(null);
    setIsLoading(true);
    const illustration = startDreamIllustration(dreamText);
    try {
      const response = await interpretDream({
        dreamText,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      const dreamId = addItem({
        type: "dream",
        question: "Толкование сна",
        answer: response.title,
        dreamText,
        dreamInterpretation: response.interpretation,
        dreamSymbols: response.symbols,
        dreamAdvice: response.advice,
        dreamImageStatus: "pending",
      });
      applyDreamIllustration(dreamId, illustration, updateItem);
      setText("");
      router.push(`/dream-result?id=${encodeURIComponent(dreamId)}` as never);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Не удалось получить толкование. Попробуйте ещё раз.";
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setIsLoading(false);
    }
  }, [addItem, isLoading, router, text, updateItem]);

  if (isLoading) {
    return <DreamInterpretLoadingScreen />;
  }

  return (
    <View style={styles.root} testID="dreambook-root">
      <CosmicBackground variant="dream" />
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
            <ScreenHeading
              title="Сонник"
              deck="Опишите свой сон — поможем раскрыть его тайный смысл."
            />

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
                  contentPosition="right center"
                  cachePolicy="memory-disk"
                  pointerEvents="none"
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
                  pointerEvents="none"
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
                      maxLength={DREAM_TEXT_MAX_LENGTH}
                      style={styles.dreamInput}
                      underlineColorAndroid="transparent"
                    />

                    {dictation.isAvailable ? (
                      <Pressable
                        onPress={onPressMic}
                        hitSlop={8}
                        accessibilityLabel={
                          dictation.isListening
                            ? "Остановить запись"
                            : "Надиктовать сон"
                        }
                        style={({ pressed }) => [
                          styles.micButton,
                          dictation.isListening && styles.micButtonActive,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        {dictation.isListening ? (
                          <Animated.View
                            style={[styles.micPulse, pulseStyle]}
                            pointerEvents="none"
                          />
                        ) : null}
                        {dictation.isListening ? (
                          <MicOff color="#FFF7EA" size={16} strokeWidth={1.9} />
                        ) : (
                          <Mic
                            color={theme.colors.gold}
                            size={16}
                            strokeWidth={1.7}
                          />
                        )}
                      </Pressable>
                    ) : null}
                  </GlassCard>

                  {dictation.isListening || dictation.partialTranscript ? (
                    <View style={styles.dictationRow}>
                      <View style={styles.dictationDot} />
                      <Text
                        style={styles.dictationText}
                        numberOfLines={2}
                      >
                        {dictation.partialTranscript
                          ? dictation.partialTranscript
                          : "Слушаю… говорите свой сон."}
                      </Text>
                    </View>
                  ) : null}

                  {dictation.error ? (
                    <Text style={styles.dictationError}>{dictation.error}</Text>
                  ) : null}

                  <Pressable
                    disabled={ctaDisabled}
                    style={[styles.ctaWrap, ctaDisabled && styles.ctaWrapDisabled]}
                    onPress={handleInterpret}
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
                      <Text style={[styles.ctaLabel, ctaDisabled && styles.ctaLabelMuted]}>
                        Узнать значение
                      </Text>
                      <ArrowRight
                        color={ctaDisabled ? "#C9BED6" : "#FFF7EA"}
                        size={18}
                        strokeWidth={2}
                      />
                    </LinearGradient>
                  </Pressable>

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                </View>
              </GlassCard>

              <View style={styles.sectionHeadBetween}>
                <Text style={styles.sectionLabelTight}>Недавние толкования</Text>
                <Pressable
                  hitSlop={8}
                  style={styles.seeAllPress}
                  onPress={() => selectTab("history")}
                  accessibilityLabel="Смотреть все толкования"
                >
                  <Text style={styles.seeLink}>Смотреть все</Text>
                  <ArrowRight color={theme.colors.gold} size={14} strokeWidth={2} />
                </Pressable>
              </View>

              <GlassCard
                borderColor={theme.colors.borderPurple}
                intensity={18}
                surfaceColor="rgba(98,82,142,0.1)"
                overlayColor="rgba(116,95,168,0.08)"
                style={styles.recentPanel}
              >
                {recentDreams.length === 0 ? (
                  <View style={styles.recentEmpty}>
                    <Text style={styles.recentEmptyTitle}>Пока нет толкований</Text>
                    <Text style={styles.recentEmptyText}>
                      Опишите сон выше — и недавние расшифровки появятся здесь.
                    </Text>
                  </View>
                ) : (
                  recentDreams.map((it, idx) => (
                    <Pressable
                      key={it.id}
                      onPress={() =>
                        router.push(`/dream-result?id=${encodeURIComponent(it.id)}` as never)
                      }
                      style={({ pressed }) => [
                        styles.recentRow,
                        idx < recentDreams.length - 1 && styles.recentRowBorder,
                        pressed && { opacity: 0.92 },
                      ]}
                    >
                      {it.imageUrl ? (
                        <Image
                          source={{ uri: it.imageUrl }}
                          style={styles.recentThumb}
                          contentFit="cover"
                        />
                      ) : null}
                      <View style={styles.recentBody}>
                        <Text style={styles.recentTitle} numberOfLines={1}>
                          {it.title}
                        </Text>
                        <Text style={styles.recentSnippet} numberOfLines={2}>
                          {it.snippet}
                        </Text>
                        <View style={styles.recentMeta}>
                          {it.date ? <Text style={styles.recentDate}>{it.date}</Text> : null}
                          {it.tag ? (
                            <View style={styles.recentTag}>
                              <Sparkles color={theme.colors.gold} size={10} strokeWidth={1.7} />
                              <Text style={styles.recentTagText}>{it.tag}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <ArrowRight color={theme.colors.textDim} size={20} strokeWidth={1.8} />
                    </Pressable>
                  ))
                )}
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
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "100%",
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
  },
  dreamInput: {
    width: "100%",
    height: DREAM_INPUT_BOX_H,
    maxHeight: DREAM_INPUT_BOX_H,
    paddingLeft: 16,
    paddingRight: 36,
    paddingTop: 12,
    paddingBottom: 52,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.text,
    // @ts-ignore - web only
    outlineStyle: "none",
  },
  micButton: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    backgroundColor: "rgba(24,22,40,0.7)",
    overflow: "hidden",
  },
  micButtonActive: {
    borderColor: "rgba(239,160,192,0.8)",
    backgroundColor: "rgba(196,123,234,0.55)",
  },
  micPulse: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    backgroundColor: "rgba(239,160,192,0.55)",
  },
  dictationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  dictationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EFA0C0",
    marginTop: 6,
  },
  dictationText: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textDim,
    fontStyle: "italic",
  },
  dictationError: {
    marginTop: 8,
    color: "#F4B2C0",
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
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
  errorText: {
    marginTop: 10,
    color: "#F4B2C0",
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
  },
  /** Как OracleScreen.sourceTitle */
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

  seeLink: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
  },
  seeAllPress: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 10,
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
  recentThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "rgba(246,240,255,0.08)",
  },
  recentBody: { flex: 1, minWidth: 0 },
  recentEmpty: {
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  recentEmptyTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: 15,
    color: theme.colors.text,
    marginBottom: 6,
    textAlign: "center",
  },
  recentEmptyText: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textDim,
    textAlign: "center",
    maxWidth: 260,
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
