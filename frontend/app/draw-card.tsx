import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  BookOpenCheck,
  ChevronDown,
  ChevronUp,
  Quote,
  Share2,
  Sparkles as SparklesIcon,
  X,
} from "lucide-react-native";
import { theme } from "../src/theme";
import CosmicBackground from "../src/components/CosmicBackground";
import GlassCard from "../src/components/GlassCard";
import TarotCard from "../src/components/TarotCard";
import Sparkles from "../src/components/Sparkles";
import { TAROT_DECK, TarotCard as TarotCardType } from "../src/data/tarotCards";
import { getCardReading } from "../src/data/tarotReadings";
import { useDailyCard } from "../src/hooks/useDailyCard";
import { useHistory } from "../src/context/HistoryContext";

type Phase = "choosing" | "revealing" | "result" | "loading" | "error";

const CARD_W = 110;
const CARD_H = 168;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function pickThree(deck: TarotCardType[], excludeId?: string): TarotCardType[] {
  const pool = excludeId ? deck.filter((c) => c.id !== excludeId) : deck.slice();
  const out: TarotCardType[] = [];
  while (out.length < 3 && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Main screen                                                        */
/* ------------------------------------------------------------------ */

export default function DrawCardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    card: storedCard,
    hasDrawn,
    loading,
    error,
    saveCard,
    refresh: refreshDailyCard,
  } = useDailyCard();
  const { addItem } = useHistory();

  useFocusEffect(
    useCallback(() => {
      void refreshDailyCard();
    }, [refreshDailyCard]),
  );

  // Three random face-down candidates, picked once per session.
  const threeCards = useMemo(() => pickThree(TAROT_DECK, storedCard?.id), [storedCard?.id]);

  const [phase, setPhase] = useState<Phase>("loading");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [intention, setIntention] = useState("");
  const [intentionOpen, setIntentionOpen] = useState(false);
  const [readMore, setReadMore] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Reduced-motion detection (subscribes for live changes)
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (v) => setReduceMotion(v),
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // Sync phase with hydration / persistence state
  useEffect(() => {
    if (loading) {
      setPhase("loading");
      return;
    }
    if (error && !storedCard) {
      setPhase("error");
      return;
    }
    if (hasDrawn && storedCard) {
      setPhase("result");
      return;
    }
    setPhase("choosing");
  }, [loading, error, hasDrawn, storedCard]);

  // The card finally shown on the result screen
  const finalCard: TarotCardType | null =
    storedCard ?? (selectedIdx !== null ? threeCards[selectedIdx] : null);
  const reading = finalCard ? getCardReading(finalCard) : null;

  const handleClose = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }, [router]);

  const handleSelectCard = useCallback(
    async (idx: number) => {
      if (phase !== "choosing") return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      setSelectedIdx(idx);
      setPhase("revealing");

      const chosen = threeCards[idx];
      // Persist as today's official card (idempotent on the same day).
      try {
        await saveCard(chosen.id, intention.trim() || undefined);
        addItem({
          type: "tarot",
          question: "Карта дня",
          answer: `${chosen.nameRu} — ${chosen.short}`,
          cardId: chosen.id,
          cardName: chosen.nameRu,
          intent: intention.trim() || undefined,
        });
      } catch {
        // useDailyCard sets its own error state; the result phase still works
        // because finalCard falls back to selected index.
      }

      // Time the reveal so it feels ritual-like, not rushed.
      const revealMs = reduceMotion ? 450 : 1600;
      setTimeout(() => {
        setPhase("result");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {},
        );
      }, revealMs);
    },
    [phase, threeCards, intention, saveCard, addItem, reduceMotion],
  );

  const handleSaveBack = useCallback(() => {
    setSavedFeedback(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    setTimeout(handleClose, 450);
  }, [handleClose]);

  const handleShare = useCallback(async () => {
    if (!finalCard || !reading) return;
    try {
      await Share.share({
        message: `🔮 Моя карта дня: ${finalCard.nameRu}\n«${reading.quote}»\n\n${finalCard.short}`,
      });
    } catch {
      // ignore
    }
  }, [finalCard, reading]);

  /* ---------- Render branches ---------- */

  return (
    <View style={styles.root}>
      <CosmicBackground />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) - insets.top }]}>
          <Pressable
            style={styles.closeBtn}
            onPress={handleClose}
            hitSlop={10}
            testID="draw-close-btn"
          >
            <X color={theme.colors.text} size={20} strokeWidth={1.8} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            {phase === "loading" && (
              <View style={styles.center}>
                <ActivityIndicator color={theme.colors.gold} size="large" />
                <Text style={styles.loadingText}>Загружаем карту дня…</Text>
              </View>
            )}

            {phase === "error" && (
              <ErrorBlock onRetry={() => setPhase("choosing")} message={error} />
            )}

            {(phase === "choosing" || phase === "revealing") && (
              <ChooseBlock
                threeCards={threeCards}
                phase={phase}
                selectedIdx={selectedIdx}
                onSelect={handleSelectCard}
                intention={intention}
                onChangeIntention={setIntention}
                intentionOpen={intentionOpen}
                onToggleIntention={() => setIntentionOpen((v) => !v)}
                reduceMotion={reduceMotion}
              />
            )}

            {phase === "result" && finalCard && reading && (
              <ResultBlock
                card={finalCard}
                reading={reading}
                intention={intention || ""}
                readMore={readMore}
                onToggleReadMore={() => setReadMore((v) => !v)}
                onSave={handleSaveBack}
                onShare={handleShare}
                saved={savedFeedback}
                reduceMotion={reduceMotion}
                cameFromExistingDraw={hasDrawn && !!storedCard && selectedIdx === null}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Choose / reveal block                                              */
/* ------------------------------------------------------------------ */

type ChooseProps = {
  threeCards: TarotCardType[];
  phase: Phase;
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
  intention: string;
  onChangeIntention: (v: string) => void;
  intentionOpen: boolean;
  onToggleIntention: () => void;
  reduceMotion: boolean;
};

function ChooseBlock({
  threeCards,
  phase,
  selectedIdx,
  onSelect,
  intention,
  onChangeIntention,
  intentionOpen,
  onToggleIntention,
  reduceMotion,
}: ChooseProps) {
  return (
    <View style={styles.chooseWrap}>
      <Animated.View entering={FadeInDown.delay(50).duration(500)}>
        <Text style={styles.eyebrow}>ТАРО ДНЯ</Text>
        <Text style={styles.titleDisplay}>Выбери{"\n"}свою карту</Text>
        <Text style={styles.subtitle}>
          Сделай вдох. Прикоснись к той, что зовёт.
        </Text>
      </Animated.View>

      {/* Intention (collapsible) */}
      <Animated.View
        entering={FadeInDown.delay(150).duration(500)}
        style={styles.intentWrap}
      >
        <Pressable
          onPress={onToggleIntention}
          style={styles.intentToggle}
          hitSlop={6}
          testID="intent-toggle"
        >
          <View style={styles.intentToggleLeft}>
            <SparklesIcon
              color={theme.colors.gold}
              size={14}
              strokeWidth={1.6}
            />
            <Text style={styles.intentToggleText}>
              {intentionOpen ? "Намерение" : "Задать намерение (необязательно)"}
            </Text>
          </View>
          {intentionOpen ? (
            <ChevronUp color={theme.colors.textDim} size={16} />
          ) : (
            <ChevronDown color={theme.colors.textDim} size={16} />
          )}
        </Pressable>
        {intentionOpen && (
          <Animated.View entering={FadeIn.duration(220)} style={styles.intentBox}>
            <TextInput
              value={intention}
              onChangeText={onChangeIntention}
              placeholder="Какого совета ты ищешь сегодня?"
              placeholderTextColor={theme.colors.textDim}
              style={styles.intentInput}
              maxLength={120}
              multiline
              editable={phase === "choosing"}
              testID="intent-input"
            />
          </Animated.View>
        )}
      </Animated.View>

      {/* The 3 cards row */}
      <View style={styles.cardsRow} testID="choose-cards-row">
        {threeCards.map((c, i) => (
          <ChoiceCard
            key={c.id + i}
            card={c}
            index={i}
            selected={selectedIdx === i}
            phase={phase}
            selectedIdx={selectedIdx}
            onPress={() => onSelect(i)}
            reduceMotion={reduceMotion}
          />
        ))}
      </View>

      {/* Hint */}
      {phase === "choosing" && (
        <Animated.Text
          entering={FadeIn.delay(400).duration(500)}
          style={styles.hint}
        >
          Прикоснись пальцем к одной из карт
        </Animated.Text>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Single choice card with idle-float, lift-on-select, fade-others    */
/* ------------------------------------------------------------------ */

type ChoiceProps = {
  card: TarotCardType;
  index: number;
  selected: boolean;
  selectedIdx: number | null;
  phase: Phase;
  onPress: () => void;
  reduceMotion: boolean;
};

function ChoiceCard({
  card,
  index,
  selected,
  selectedIdx,
  phase,
  onPress,
  reduceMotion,
}: ChoiceProps) {
  const float = useSharedValue(0);
  const lift = useSharedValue(0);
  const fade = useSharedValue(1);
  const glow = useSharedValue(0);
  const [doFlip, setDoFlip] = useState(false);
  const flipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Idle floating during the choosing phase.
  useEffect(() => {
    if (reduceMotion || phase !== "choosing") {
      cancelAnimation(float);
      float.value = withTiming(0, { duration: 200 });
      return;
    }
    const startDelay = index * 320;
    const dur = 1800 + index * 220;
    float.value = withDelay(
      startDelay,
      withRepeat(
        withSequence(
          withTiming(-8, { duration: dur, easing: Easing.inOut(Easing.sin) }),
          withTiming(6, { duration: dur, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(float);
  }, [phase, reduceMotion, index, float]);

  // Reveal animation for the selected / unselected cards.
  useEffect(() => {
    if (phase !== "revealing" || selectedIdx === null) return;
    if (selected) {
      const liftDur = reduceMotion ? 220 : 520;
      const flipDur = reduceMotion ? 220 : 700;
      lift.value = withTiming(1, {
        duration: liftDur,
        easing: Easing.out(Easing.cubic),
      });
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 700 }),
          withTiming(0.4, { duration: 700 }),
        ),
        -1,
        true,
      );
      flipTimer.current = setTimeout(() => setDoFlip(true), liftDur);
      // After flip completes, glow stays subtle.
      void flipDur;
    } else {
      fade.value = withTiming(0, {
        duration: reduceMotion ? 220 : 420,
        easing: Easing.out(Easing.cubic),
      });
    }
    return () => {
      if (flipTimer.current) clearTimeout(flipTimer.current);
    };
  }, [phase, selectedIdx, selected, reduceMotion, lift, fade, glow]);

  const wrapStyle = useAnimatedStyle(() => {
    const baseRotate = (index - 1) * 8; // -8°, 0°, 8°
    const scale = interpolate(lift.value, [0, 1], [1, 1.08]);
    const ty = interpolate(lift.value, [0, 1], [float.value, -28]);
    const tx = (1 - fade.value) * (index - 1) * 90;
    const rotateZ = interpolate(lift.value, [0, 1], [baseRotate, 0]);
    return {
      opacity: fade.value,
      transform: [
        { translateX: tx },
        { translateY: ty },
        { scale },
        { rotate: `${rotateZ}deg` },
      ],
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.85,
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.85, 1.12]) }],
  }));

  const tappable = phase === "choosing";

  return (
    <Animated.View style={[styles.choiceWrap, wrapStyle]}>
      {/* Glow halo behind the selected card during reveal */}
      {(phase === "revealing" || phase === "result") && selected && (
        <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />
      )}

      <TarotCard
        card={card}
        flipped={doFlip}
        onFlip={tappable ? onPress : undefined}
        width={CARD_W}
        height={CARD_H}
        hideFrontText
        testID={`choice-card-${index}`}
      />

      {/* Sparkles burst when this card is the selected one and is flipping */}
      {selected && (phase === "revealing" || phase === "result") && (
        <View pointerEvents="none" style={styles.sparkleAnchor}>
          <Sparkles
            count={10}
            size={CARD_W + 80}
            reduceMotion={reduceMotion}
          />
        </View>
      )}
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/*  Result block                                                       */
/* ------------------------------------------------------------------ */

type ResultProps = {
  card: TarotCardType;
  reading: ReturnType<typeof getCardReading>;
  intention: string;
  readMore: boolean;
  onToggleReadMore: () => void;
  onSave: () => void;
  onShare: () => void;
  saved: boolean;
  reduceMotion: boolean;
  cameFromExistingDraw: boolean;
};

function ResultBlock({
  card,
  reading,
  intention,
  readMore,
  onToggleReadMore,
  onSave,
  onShare,
  saved,
  reduceMotion,
  cameFromExistingDraw,
}: ResultProps) {
  const fadeDelay = reduceMotion ? 0 : 220;

  return (
    <View style={styles.resultWrap} testID="result-block">
      {/* Centred final card art */}
      <View style={styles.finalCardWrap}>
        <View style={styles.finalCardGlow} />
        <Sparkles
          count={12}
          size={280}
          reduceMotion={reduceMotion}
          style={styles.finalSparkles}
        />
        <TarotCard
          card={card}
          flipped
          width={200}
          height={300}
          testID="result-card"
        />
      </View>

      <Animated.View entering={FadeIn.delay(fadeDelay).duration(550)}>
        <Text style={styles.resultEyebrow}>ТВОЯ КАРТА НА СЕГОДНЯ</Text>
        <Text style={styles.resultName} testID="result-card-name">
          {card.nameRu}
        </Text>

        <View style={styles.energyPill}>
          <SparklesIcon color={theme.colors.gold} size={12} strokeWidth={1.8} />
          <Text style={styles.energyText}>{reading.energy.toUpperCase()}</Text>
        </View>

        <Text style={styles.shortMeaning}>{card.short}</Text>
      </Animated.View>

      <Animated.View
        entering={FadeIn.delay(fadeDelay + 80).duration(550)}
        style={styles.adviceRow}
      >
        <Quote
          color={theme.colors.gold}
          size={16}
          strokeWidth={1.8}
          style={{ marginTop: 3 }}
        />
        <Text style={styles.adviceText}>{reading.advice}</Text>
      </Animated.View>

      {/* Reflection card */}
      <Animated.View entering={FadeIn.delay(fadeDelay + 160).duration(550)}>
        <GlassCard
          borderColor={theme.colors.borderPurple}
          style={styles.reflectionCard}
        >
          <View style={styles.reflectionInner}>
            <Text style={styles.reflectionLabel}>ВОПРОС ДЛЯ РАЗМЫШЛЕНИЯ</Text>
            <Text style={styles.reflectionText}>{reading.reflection}</Text>
          </View>
        </GlassCard>
      </Animated.View>

      {/* Read more (full meaning) */}
      <Animated.View entering={FadeIn.delay(fadeDelay + 240).duration(550)}>
        <Pressable
          onPress={onToggleReadMore}
          style={styles.readMoreBtn}
          testID="read-more-btn"
        >
          <Text style={styles.readMoreText}>
            {readMore ? "Свернуть" : "Открыть полное значение"}
          </Text>
          {readMore ? (
            <ChevronUp color={theme.colors.gold} size={14} />
          ) : (
            <ChevronDown color={theme.colors.gold} size={14} />
          )}
        </Pressable>
        {readMore && (
          <Animated.View
            entering={FadeIn.duration(280)}
            style={styles.detailedBox}
          >
            <Text style={styles.detailedText}>{card.detailed}</Text>
          </Animated.View>
        )}
      </Animated.View>

      {/* Optional intention echo */}
      {!!intention && (
        <Animated.View
          entering={FadeIn.delay(fadeDelay + 280).duration(500)}
          style={styles.intentionEcho}
        >
          <Text style={styles.intentionEchoLabel}>ТВОЁ НАМЕРЕНИЕ</Text>
          <Text style={styles.intentionEchoText}>«{intention}»</Text>
        </Animated.View>
      )}

      {/* Actions */}
      <Animated.View
        entering={FadeIn.delay(fadeDelay + 320).duration(550)}
        style={styles.actionsRow}
      >
        <Pressable
          onPress={onSave}
          style={styles.primaryBtnWrap}
          testID="save-journal-btn"
        >
          <LinearGradient
            colors={["#EFA0C0", "#B98BE5", "#9D7CE6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryBtn}
          >
            <BookOpenCheck color="#FFF7EA" size={16} strokeWidth={1.8} />
            <Text style={styles.primaryBtnText}>
              {cameFromExistingDraw ? "Готово" : saved ? "Сохранено ✓" : "В дневник"}
            </Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={onShare}
          style={styles.ghostBtn}
          testID="share-btn"
        >
          <Share2 color={theme.colors.text} size={16} strokeWidth={1.8} />
          <Text style={styles.ghostBtnText}>Поделиться</Text>
        </Pressable>
      </Animated.View>

      <View style={{ height: 80 }} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Error block                                                        */
/* ------------------------------------------------------------------ */

function ErrorBlock({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorTitle}>Что-то пошло не так</Text>
      <Text style={styles.errorMsg}>
        {message ?? "Не удалось открыть карту дня. Попробуй ещё раз."}
      </Text>
      <Pressable style={styles.retryBtn} onPress={onRetry}>
        <Text style={styles.retryBtnText}>Попробовать снова</Text>
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },

  header: {
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
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 32,
    minHeight: "100%",
  },
  center: {
    flex: 1,
    minHeight: 360,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  loadingText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 13,
  },

  /* ---------- Choose phase ---------- */
  chooseWrap: { flex: 1 },
  eyebrow: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10.5,
    letterSpacing: 2.4,
    marginTop: 4,
    marginBottom: 10,
  },
  titleDisplay: {
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: 0.2,
  },
  subtitle: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    maxWidth: 320,
  },

  /* Intention */
  intentWrap: {
    marginTop: 22,
    marginBottom: 6,
  },
  intentToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(35,31,58,0.55)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  intentToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  intentToggleText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  intentBox: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: "rgba(35,31,58,0.55)",
    borderWidth: 1,
    borderColor: theme.colors.borderPurple,
    padding: 14,
  },
  intentInput: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 48,
    padding: 0,
    fontStyle: "italic",
  },

  /* Cards row */
  cardsRow: {
    marginTop: 36,
    marginBottom: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
    minHeight: CARD_H + 30,
  },
  choiceWrap: {
    width: CARD_W,
    height: CARD_H,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: CARD_W + 60,
    height: CARD_H + 60,
    borderRadius: (CARD_W + 60) / 2,
    backgroundColor: "rgba(196,123,234,0.22)",
    shadowColor: theme.colors.mauve,
    shadowOpacity: 0.9,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
  },
  sparkleAnchor: {
    position: "absolute",
    top: -40,
    left: -40,
    right: -40,
    bottom: -40,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    textAlign: "center",
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 12.5,
    fontStyle: "italic",
    marginTop: 18,
  },

  /* ---------- Result ---------- */
  resultWrap: {
    paddingTop: 6,
    alignItems: "stretch",
  },
  finalCardWrap: {
    alignItems: "center",
    justifyContent: "center",
    height: 320,
    marginBottom: 10,
  },
  finalCardGlow: {
    position: "absolute",
    width: 240,
    height: 320,
    borderRadius: 200,
    backgroundColor: "rgba(196,123,234,0.16)",
    shadowColor: theme.colors.mauve,
    shadowOpacity: 0.55,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },
  finalSparkles: {
    position: "absolute",
  },
  resultEyebrow: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10.5,
    letterSpacing: 2.6,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 6,
  },
  resultName: {
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    fontSize: 32,
    lineHeight: 38,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  energyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    backgroundColor: "rgba(255,215,154,0.08)",
  },
  energyText: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10.5,
    letterSpacing: 2,
  },
  shortMeaning: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
    marginTop: 16,
    fontStyle: "italic",
    paddingHorizontal: 6,
  },
  adviceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 18,
    paddingHorizontal: 4,
  },
  adviceText: {
    flex: 1,
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 21,
  },

  reflectionCard: {
    marginTop: 22,
  },
  reflectionInner: {
    padding: 18,
  },
  reflectionLabel: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 2.2,
    marginBottom: 8,
  },
  reflectionText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 17,
    lineHeight: 24,
    fontStyle: "italic",
  },

  readMoreBtn: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
  },
  readMoreText: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  detailedBox: {
    marginTop: 8,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "rgba(35,31,58,0.45)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  detailedText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 13.5,
    lineHeight: 21,
  },

  intentionEcho: {
    marginTop: 18,
    paddingHorizontal: 6,
  },
  intentionEchoLabel: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 2.2,
    marginBottom: 6,
  },
  intentionEchoText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 15,
    lineHeight: 22,
    fontStyle: "italic",
  },

  actionsRow: {
    marginTop: 26,
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
  },
  primaryBtnWrap: {
    flex: 1,
    borderRadius: 999,
    shadowColor: theme.colors.pink,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  primaryBtnText: {
    color: "#FFF7EA",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
    letterSpacing: 0.4,
  },
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: "rgba(35,31,58,0.45)",
  },
  ghostBtnText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    letterSpacing: 0.3,
  },

  /* Error */
  errorTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    fontSize: 22,
    textAlign: "center",
  },
  errorMsg: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  retryBtn: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
  },
  retryBtnText: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
  },
});
