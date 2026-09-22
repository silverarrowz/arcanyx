import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  View,
  Dimensions,
  Image as RNImage,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useRouter, useScrollToTop } from "expo-router";
import * as Haptics from "expo-haptics";
import { ArrowLeft, PenLine, Sparkles, Fingerprint } from "lucide-react-native";
import { theme } from "../theme";
import ScreenHeading from "../components/ScreenHeading";
import CosmicBackground from "../components/CosmicBackground";
import GlassCard from "../components/GlassCard";
import {
  CATEGORY_META,
  ORACLE_SOURCE_META,
  ORACLE_SOURCES,
  getRandomOracleAnswer,
  OracleCategory,
  OracleSource,
} from "../data/oracleAnswers";
import { useHistory } from "../context/HistoryContext";

type Phase = "idle" | "loading" | "result";

const BALL_IMAGE = require("../../assets/oracle/ball2.jpg");
const BALL_ASPECT_RATIO = 1086 / 1700;

/**
 * Изображение уже содержит нужное пустое пространство над шаром.
 * Увеличение слоя здесь обрезает это пространство и визуально поднимает шар.
 */
const ORACLE_BALL_VERTICAL_NUDGE = 0;
/** Компактность полосы с шаром: меньше — меньше высота героя (больше места под форму). */
const ORACLE_HERO_HEIGHT_FRAC = 0.82;
const ORACLE_HERO_MAX_SCREEN_FRAC = 0.65;
const ORACLE_HERO_MAX_EMBEDDED_FRAC = 0.58;
/** Круговая зона long-press на шаре: доля ширины экрана и героя; ↑ = крупнее hit-target. */
const ORACLE_BALL_HIT_SIZE_FRAC_W = 0.76;
const ORACLE_BALL_HIT_MAX_FRAC_HERO_H = 0.52;
const ORACLE_BALL_HIT_BOTTOM_FRAC = 0.28;
const ORACLE_BALL_LONG_PRESS_MS = 450;

const ORACLE_SOURCE_BACKGROUNDS: Record<OracleSource, number> = {
  universe: require("../../assets/oracle/bg1.jpg"),
  innerSelf: require("../../assets/oracle/bg2.jpg"),
  shadow: require("../../assets/oracle/bg3.jpg"),
};

const SOURCE_CARD_H = 132;
const SOURCE_PHOTO_H = 210;

/** Extra photo height is clipped; `top` picks face / orb / clouds. */
const ORACLE_SOURCE_PHOTO_TOP: Record<OracleSource, number> = {
  universe: -58,
  innerSelf: 0,
  shadow: -28,
};

const MIST_CYCLE = [
  "#7C3AED",
  "#22D3EE",
  "#EC4899",
  "#F59E0B",
  "#7C3AED",
] as const;

function interpolateGlowColor(progress: number) {
  const segmentCount = MIST_CYCLE.length - 1;
  const scaled = Math.min(progress, 0.9999) * segmentCount;
  const index = Math.floor(scaled);
  const amount = scaled - index;
  const from = MIST_CYCLE[index];
  const to = MIST_CYCLE[index + 1];
  const channel = (start: number, end: number) =>
    Math.round(start + (end - start) * amount);
  const fromRgb = [
    parseInt(from.slice(1, 3), 16),
    parseInt(from.slice(3, 5), 16),
    parseInt(from.slice(5, 7), 16),
  ];
  const toRgb = [
    parseInt(to.slice(1, 3), 16),
    parseInt(to.slice(3, 5), 16),
    parseInt(to.slice(5, 7), 16),
  ];

  return `rgb(${channel(fromRgb[0], toRgb[0])}, ${channel(fromRgb[1], toRgb[1])}, ${channel(fromRgb[2], toRgb[2])})`;
}

const ORACLE_PARTICLES = [
  { x: 0.1, y: 0.2, size: 2, delay: 0, duration: 2600 },
  { x: 0.88, y: 0.24, size: 2, delay: 420, duration: 3200 },
  { x: 0.08, y: 0.38, size: 2, delay: 760, duration: 2800 },
  { x: 0.92, y: 0.42, size: 2, delay: 1100, duration: 3000 },
  { x: 0.06, y: 0.58, size: 2, delay: 360, duration: 3400 },
  { x: 0.94, y: 0.62, size: 2, delay: 900, duration: 2900 },
  { x: 0.12, y: 0.76, size: 2, delay: 1280, duration: 3100 },
  { x: 0.88, y: 0.8, size: 2, delay: 620, duration: 2700 },
  { x: 0.24, y: 0.9, size: 2, delay: 1480, duration: 3300 },
  { x: 0.76, y: 0.92, size: 2, delay: 180, duration: 3000 },
] as const;

function OracleParticle({
  top,
  left,
  size,
  delay,
  duration,
}: {
  top: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
}) {
  const glow = useSharedValue(0);
  const haloSize = size * 12;
  const gradientId = `oracleParticleGlow${delay}`;

  useEffect(() => {
    glow.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );

    return () => cancelAnimation(glow);
  }, [delay, duration, glow]);

  const particleStyle = useAnimatedStyle(() => ({
    opacity: 0.38 + glow.value * 0.62,
    transform: [{ scale: 0.72 + glow.value * 0.62 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          top,
          left,
          width: haloSize,
          height: haloSize,
          marginLeft: -haloSize / 2,
          marginTop: -haloSize / 2,
          borderRadius: haloSize / 2,
        },
        particleStyle,
      ]}
    >
      <Svg width={haloSize} height={haloSize}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={theme.colors.gold} stopOpacity={0.95} />
            <Stop offset="18%" stopColor={theme.colors.gold} stopOpacity={0.55} />
            <Stop offset="46%" stopColor={theme.colors.pink} stopOpacity={0.22} />
            <Stop offset="100%" stopColor={theme.colors.pink} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

function OracleRadialGlow({
  size,
  top,
  left,
  cycling,
  loadingLayer,
  resultLayer,
}: {
  size: number;
  top: number;
  left: number;
  cycling: boolean;
  loadingLayer: SharedValue<number>;
  resultLayer: SharedValue<number>;
}) {
  const [color, setColor] = useState<string>(MIST_CYCLE[0]);

  useEffect(() => {
    if (!cycling) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const progress = ((Date.now() - startedAt) % 2800) / 2800;
      setColor(interpolateGlowColor(progress));
    }, 50);

    return () => clearInterval(timer);
  }, [cycling]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: Math.max(loadingLayer.value, resultLayer.value),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.centeredGlow,
        { width: size, height: size, top, left },
        glowStyle,
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="oracleAnimatedGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.96} />
            <Stop offset="24%" stopColor={color} stopOpacity={0.78} />
            <Stop offset="52%" stopColor={color} stopOpacity={0.42} />
            <Stop offset="88%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#oracleAnimatedGlow)" />
      </Svg>
    </Animated.View>
  );
}

type OracleScreenProps = {
  /** When true, top safe area is handled by the parent (e.g. Gadania segment header). */
  embedded?: boolean;
  /** When set, restore this diary entry into the result view. */
  historyId?: string;
};

const ORACLE_CATEGORY_IDS: OracleCategory[] = ["yes", "no", "vague", "snarky"];
const ORACLE_SOURCE_IDS: OracleSource[] = ["universe", "innerSelf", "shadow"];

function asOracleCategory(value: string | undefined): OracleCategory {
  return ORACLE_CATEGORY_IDS.includes(value as OracleCategory)
    ? (value as OracleCategory)
    : "vague";
}

function asOracleSource(value: string | undefined): OracleSource {
  return ORACLE_SOURCE_IDS.includes(value as OracleSource)
    ? (value as OracleSource)
    : "universe";
}

export default function OracleScreen({
  embedded = false,
  historyId,
}: OracleScreenProps) {
  const router = useRouter();
  const { width: screenW, height: screenH } = Dimensions.get("window");
  const heroNatural = screenW / BALL_ASPECT_RATIO;
  const heroMaxFrac = embedded
    ? ORACLE_HERO_MAX_EMBEDDED_FRAC
    : ORACLE_HERO_MAX_SCREEN_FRAC;
  const heroHeight = Math.min(
    heroNatural * ORACLE_HERO_HEIGHT_FRAC,
    screenH * heroMaxFrac,
  );
  const heroImageNudgeY = screenW * ORACLE_BALL_VERTICAL_NUDGE;

  const { items, hydrated } = useHistory();
  const appliedArchiveRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [selectedSource, setSelectedSource] =
    useState<OracleSource>("universe");
  const [result, setResult] = useState<{
    category: OracleCategory;
    answer: string;
    source: OracleSource;
  } | null>(null);
  const [archiveMissing, setArchiveMissing] = useState(false);
  const [archiveReady, setArchiveReady] = useState(!historyId);

  const breathing = useSharedValue(1);
  const loadingLayer = useSharedValue(0);
  const resultLayer = useSharedValue(0);
  const answerOpacity = useSharedValue(0);

  useEffect(() => {
    breathing.value = withRepeat(
      withTiming(1.02, { duration: 2800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(breathing);
  }, [breathing]);

  useEffect(() => {
    if (phase === "loading") {
      loadingLayer.value = withTiming(1, { duration: 450 });
      resultLayer.value = withTiming(0, { duration: 320 });
      answerOpacity.value = 0;
    } else if (phase === "result") {
      loadingLayer.value = withTiming(0, { duration: 520 });
      resultLayer.value = withDelay(
        180,
        withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
      );
      answerOpacity.value = withDelay(
        420,
        withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }),
      );
    } else {
      loadingLayer.value = withTiming(0, { duration: 380 });
      resultLayer.value = withTiming(0, { duration: 320 });
      answerOpacity.value = withTiming(0, { duration: 220 });
    }
  }, [phase, loadingLayer, resultLayer, answerOpacity]);

  useEffect(() => {
    if (!historyId || !hydrated || appliedArchiveRef.current) return;
    appliedArchiveRef.current = true;
    const item = items.find((it) => it.id === historyId && it.type === "oracle");
    if (!item) {
      setArchiveMissing(true);
      setArchiveReady(true);
      return;
    }
    const source = asOracleSource(item.oracleSource);
    setQuestion(item.question);
    setSelectedSource(source);
    setResult({
      category: asOracleCategory(item.category),
      answer: item.answer,
      source,
    });
    setPhase("result");
    setArchiveReady(true);
  }, [historyId, hydrated, items]);

  const answerWrapStyle = useAnimatedStyle(() => ({
    opacity: answerOpacity.value,
    transform: [{ translateY: (1 - answerOpacity.value) * 12 }],
  }));

  const askUniverse = () => {
    if (phase === "loading") return;
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setPhase("loading");
    setResult(null);
    breathing.value = withSequence(
      withTiming(0.98, { duration: 120 }),
      withTiming(1.03, { duration: 200 }),
      withTiming(1, { duration: 240 }),
    );
    setTimeout(() => {
      const r = getRandomOracleAnswer(selectedSource);
      setResult(r);
      setPhase("result");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    }, 2200);
  };

  const reset = () => {
    if (historyId) return;
    setPhase("idle");
    setResult(null);
    setQuestion("");
  };

  const goBackFromArchive = () => {
    Haptics.selectionAsync().catch(() => {});
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/diary");
  };

  const meta = result ? CATEGORY_META[result.category] : null;
  const activeSourceMeta = ORACLE_SOURCE_META[selectedSource];
  /** Only idle: question/source are fixed once the user asks until they start a new round. */
  const formUnlocked = phase === "idle";
  const ballHitSize = Math.min(
    screenW * ORACLE_BALL_HIT_SIZE_FRAC_W,
    heroHeight * ORACLE_BALL_HIT_MAX_FRAC_HERO_H,
  );
  const ballHitBottom = heroHeight * ORACLE_BALL_HIT_BOTTOM_FRAC;
  const mistOrbSize = ballHitSize * 1.35;
  const mistOrbLeft = (ballHitSize - mistOrbSize) / 2;
  const mistOrbTop = (ballHitSize - mistOrbSize) / 2 + 8;

  const onBallLongPress = () => {
    if (historyId) return;
    if (phase === "loading") return;
    if (phase === "result") {
      reset();
    } else {
      askUniverse();
    }
  };

  const viewingArchive = Boolean(historyId);

  if (viewingArchive && !archiveReady) {
    return (
      <View style={styles.root}>
        <CosmicBackground />
      </View>
    );
  }

  if (viewingArchive && archiveMissing) {
    return (
      <View style={styles.root}>
        <CosmicBackground />
        <SafeAreaView
          style={styles.safe}
          edges={embedded ? ["bottom"] : ["top"]}
        >
          <View style={styles.topBackBar}>
            <Pressable
              onPress={goBackFromArchive}
              testID="oracle-archive-back"
              accessibilityRole="button"
              accessibilityLabel="Назад"
              style={({ pressed }) => [
                styles.topBackRow,
                pressed && { opacity: 0.82 },
              ]}
            >
              <ArrowLeft color={theme.colors.textDim} size={20} />
              <Text style={styles.topBackLabel}>Назад</Text>
            </Pressable>
          </View>
          <View style={styles.archiveEmpty}>
            <Text style={styles.archiveEmptyTitle}>Ответ не найден</Text>
            <Text style={styles.archiveEmptyText}>
              Эта запись больше не сохранена в дневнике.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CosmicBackground />
      <SafeAreaView
        style={styles.safe}
        edges={embedded ? ["bottom"] : ["top"]}
      >
        {viewingArchive ? (
          <View style={styles.topBackBar} pointerEvents="box-none">
            <Pressable
              onPress={goBackFromArchive}
              testID="oracle-archive-back"
              accessibilityRole="button"
              accessibilityLabel="Назад"
              style={({ pressed }) => [
                styles.topBackRow,
                pressed && { opacity: 0.82 },
              ]}
            >
              <ArrowLeft color={theme.colors.textDim} size={20} />
              <Text style={styles.topBackLabel}>Назад</Text>
            </Pressable>
          </View>
        ) : null}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              automaticallyAdjustKeyboardInsets
            >
              <View style={[styles.hero, { height: heroHeight }]}>
                {/* Слой выше героя на nudge: прижат снизу — шар ниже в кадре без пустой полосы сверху */}
                <Animated.View
                  style={[
                    styles.heroImageLayerAnchored,
                    { height: heroHeight + heroImageNudgeY },
                  ]}
                >
                  <Image
                    source={BALL_IMAGE}
                    style={styles.heroImage}
                    contentFit="cover"
                    contentPosition="center"
                    cachePolicy="memory-disk"
                    priority="high"
                    transition={0}
                  />
                </Animated.View>
                <View
                  style={styles.heroBallShift}
                  pointerEvents="none"
                >
                  <View style={styles.particleLayer} pointerEvents="none">
                    {ORACLE_PARTICLES.map((particle, index) => (
                      <OracleParticle
                        key={index}
                        top={particle.y * heroHeight}
                        left={particle.x * screenW}
                        size={particle.size}
                        delay={particle.delay}
                        duration={particle.duration}
                      />
                    ))}
                  </View>
                </View>
                <LinearGradient
                  colors={[
                    "rgba(18,16,34,0)",
                    "rgba(18,16,34,0.18)",
                    theme.colors.bg,
                  ]}
                  locations={[0, 0.45, 1]}
                  style={styles.heroFade}
                  pointerEvents="none"
                />
                
                <LinearGradient
                  colors={[theme.colors.bg, "rgba(18,16,34,0)"]}
                  locations={[0, 1]}
                  style={styles.heroTopFade}
                  pointerEvents="none"
                />

                <ScreenHeading
                  title="Спроси Оракула"
                  deck='Задайте вопрос, на который можно ответить «да» или «нет»'
                  style={styles.heroCopy}
                />

                <View
                  style={[
                    styles.answerOverlay,
                    {
                      width: ballHitSize,
                      height: ballHitSize,
                      bottom: ballHitBottom,
                    },
                  ]}
                  pointerEvents="none"
                >
                  <OracleRadialGlow
                    size={mistOrbSize}
                    top={mistOrbTop}
                    left={mistOrbLeft}
                    cycling={phase === "loading"}
                    loadingLayer={loadingLayer}
                    resultLayer={resultLayer}
                  />
                  {phase === "result" && result && meta && (
                    <Animated.View
                      pointerEvents="none"
                      style={[styles.answerTextLayer, answerWrapStyle]}
                    >
                      <Text style={styles.answerOnBall} testID="oracle-answer">
                        {result.answer}
                      </Text>
                    </Animated.View>
                  )}
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Шар оракула"
                  accessibilityHint="Удерживайте, чтобы узнать ответ или начать заново"
                  testID="oracle-ball-longpress"
                  disabled={phase === "loading"}
                  delayLongPress={ORACLE_BALL_LONG_PRESS_MS}
                  onLongPress={onBallLongPress}
                  style={[
                    styles.ballHitZone,
                    {
                      width: ballHitSize,
                      height: ballHitSize,
                      borderRadius: ballHitSize / 2,
                      bottom: ballHitBottom,
                    },
                  ]}
                />

                {phase === "idle" && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.ballHintWrap,
                      {
                        width: ballHitSize,
                        height: ballHitSize,
                        bottom: ballHitBottom,
                      },
                    ]}
                  >
                    <PulsingOracleBallHintIcon />
                    <Text style={styles.ballHintLabel}>Нажмите и удерживайте</Text>
                  </View>
                )}
              </View>

              <View style={styles.content}>
                <GlassCard
                  glow="purple"
                  borderColor={theme.colors.borderPurple}
                  intensity={8}
                  surfaceColor="rgba(98,82,142,0.22)"
                  overlayColor="rgba(116,95,168,0.18)"
                  style={[styles.inputCard, !formUnlocked && styles.inputCardFrozen]}
                >
                  <View style={styles.inputLabelRow}>
                    <Sparkles color={theme.colors.gold} size={14} />
                    <Text style={styles.inputLabel}>
                      {phase === "result"
                        ? "Твой вопрос"
                        : "Сформулируйте вопрос"}
                    </Text>
                  </View>
                  <View style={styles.inputInner}>
                    <TextInput
                      testID="oracle-input"
                      value={question}
                      onChangeText={setQuestion}
                      placeholder="Стоит ли начинать этот проект?"
                      placeholderTextColor={theme.colors.textDim}
                      style={[
                        styles.input,
                        !formUnlocked && styles.inputReadOnly,
                      ]}
                      multiline
                      editable={formUnlocked}
                    />
                    <PenLine color={theme.colors.lilac} size={18} />
                  </View>
                </GlassCard>

                {viewingArchive ? null : (
                <Pressable
                  onPress={phase === "result" ? reset : askUniverse}
                  disabled={phase === "loading"}
                  testID="oracle-ask-btn"
                  style={({ pressed }) => [
                    styles.askButton,
                    phase === "loading" && styles.askButtonMuted,
                    pressed &&
                      phase !== "loading" && { transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <LinearGradient
                    colors={
                      phase === "loading"
                        ? theme.gradients.primaryCtaMuted
                        : theme.gradients.primaryCta
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.askButtonGradient}
                  >
                    <Sparkles
                      color={phase === "loading" ? "#C9BED6" : "#FFF7EA"}
                      size={phase === "loading" ? 14 : 18}
                      strokeWidth={1.8}
                    />
                    <Text
                      style={[
                        styles.askButtonText,
                        phase === "loading" && styles.askButtonTextMuted,
                      ]}
                    >
                      {phase === "loading"
                        ? `Слушаю: ${activeSourceMeta.shortLabel}…`
                        : phase === "result"
                          ? "Задать новый вопрос"
                          : "Узнать ответ"}
                    </Text>
                  </LinearGradient>
                </Pressable>
                )}

                <View style={styles.sourceSection}>
                <Text style={styles.sourceTitle}>Кто отвечает?</Text>
                <View style={styles.sourceGrid}>
                  {ORACLE_SOURCES.map((source) => {
                    const selected = source.id === selectedSource;

                    return (
                      <Pressable
                        key={source.id}
                        disabled={!formUnlocked}
                        onPress={() => {
                          setSelectedSource(source.id);
                          Haptics.selectionAsync().catch(() => {});
                        }}
                        style={({ pressed }) => [
                          styles.sourceCard,
                          selected && styles.sourceCardActiveGlow,
                          selected && { shadowColor: source.color },
                          pressed && { transform: [{ scale: 0.98 }] },
                          !formUnlocked && { opacity: 0.55 },
                        ]}
                      >
                        <View
                          style={[
                            styles.sourceCardInner,
                            selected && {
                              borderColor: source.color + "99",
                            },
                          ]}
                        >
                          <RNImage
                            source={ORACLE_SOURCE_BACKGROUNDS[source.id]}
                            resizeMode="cover"
                            style={[
                              styles.sourceCardPhoto,
                              { top: ORACLE_SOURCE_PHOTO_TOP[source.id] },
                            ]}
                          />
                          <LinearGradient
                            colors={
                              selected
                                ? [
                                    "rgba(18,16,34,0.28)",
                                    "rgba(18,16,34,0.48)",
                                    "rgba(18,16,34,0.78)",
                                    "rgba(18,16,34,0.94)",
                                  ]
                                : [
                                    "rgba(18,16,34,0.34)",
                                    "rgba(18,16,34,0.58)",
                                    "rgba(18,16,34,0.82)",
                                    "rgba(18,16,34,0.94)",
                                  ]
                            }
                            locations={[0, 0.34, 0.7, 1]}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                            style={styles.sourceCardScrim}
                          >
                            <Text
                              style={[
                                styles.sourceLabel,
                                {
                                  color: selected
                                    ? source.color
                                    : theme.colors.text,
                                },
                              ]}
                            >
                              {source.label}
                            </Text>
                            <Text
                              style={styles.sourceSubtitle}
                              numberOfLines={2}
                            >
                              {source.subtitle}
                            </Text>
                          </LinearGradient>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ height: 72 }} />
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/** Общая типографика текста на шаре (ответ и подсказка «удерживайте»). */
const oracleBallTextBase = {
  color: theme.colors.text,
  fontFamily: theme.fonts.heading,
  fontSize: 22,
  lineHeight: 28,
  fontStyle: "italic" as const,
  textAlign: "center" as const,
  textShadowColor: "rgba(0,0,0,0.35)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 5,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  topBackBar: {
    paddingHorizontal: 24,
    paddingBottom: 2,
    zIndex: 24,
    elevation: 24,
  },
  topBackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  topBackLabel: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 14,
  },
  archiveEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  archiveEmptyTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    fontSize: 22,
    textAlign: "center",
  },
  archiveEmptyText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  scroll: { paddingTop: 0 },
  hero: {
    width: "100%",
    overflow: "hidden",
  },
  /** Прижат к низу героя; height задаётся inline как heroHeight + nudge — лишнее уходит за верхний край и клипится. */
  heroImageLayerAnchored: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroBallShift: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  particleLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  particle: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    shadowColor: theme.colors.pink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 18,
    elevation: 8,
  },
  heroFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 140,
  },
  heroTopFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  heroCopy: {
    paddingHorizontal: 24,
    paddingTop: 0,
    alignItems: "center",
    zIndex: 10,
    transform: [{ translateY: -6 }],
  },
  eyebrow: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 3,
    color: theme.colors.gold,
    marginBottom: 4,
  },
  heroDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
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
    fontSize: 30,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  subtitle: {
    color: theme.colors.lilac,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 260,
  },
  content: {
    paddingHorizontal: 24,
    marginTop: -30,
    zIndex: 10,
  },
  inputCard: {
    marginBottom: 20,
    borderRadius: 22,
  },
  inputCardFrozen: {
    opacity: 0.92,
  },
  inputLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  inputLabel: {
    color: theme.colors.lilac,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
  },
  inputInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 0,
    paddingBottom: 16,
    gap: 10,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 15,
    minHeight: 24,
    maxHeight: 100,
    paddingTop: 0,
    paddingBottom: 0,
    // @ts-ignore - web only
    outlineStyle: "none",
  },
  inputReadOnly: {
    color: theme.colors.lilac,
  },
  sourceSection: {
    marginTop: 26,
    marginBottom: 18,
  },
  sourceTitle: {
    color: theme.colors.lilac,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  sourceGrid: {
    gap: 9,
  },
  sourceCard: {
    height: SOURCE_CARD_H,
    borderRadius: 24,
    overflow: "visible",
  },
  sourceCardInner: {
    height: SOURCE_CARD_H,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(18,16,34,1)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sourceCardActiveGlow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 14,
    elevation: 8,
  },
  sourceCardPhoto: {
    position: "absolute",
    left: 0,
    width: "100%",
    height: SOURCE_PHOTO_H,
  },
  sourceCardScrim: {
    height: SOURCE_CARD_H,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 36,
    paddingBottom: 14,
    paddingRight: 24,
  },
  sourceLabel: {
    fontFamily: theme.fonts.display,
    fontSize: 22,
    letterSpacing: 0.1,
    marginBottom: 5,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  sourceSubtitle: {
    color: "rgba(229,223,242,0.88)",
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 16,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  centeredGlow: {
    position: "absolute",
  },
  answerOverlay: {
    position: "absolute",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  answerTextLayer: {
    width: "100%",
    alignItems: "center",
  },
  ballHitZone: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "transparent",
  },
  ballHintWrap: {
    position: "absolute",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  ballHintIconWrap: {
    opacity: 0.92,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 5,
    elevation: 4,
  },
  ballHintLabel: {
    ...oracleBallTextBase,
    fontSize: 16,
    lineHeight: 20,
    marginTop: 16,
    maxWidth: "78%",
  },
  answerOnBall: {
    ...oracleBallTextBase,
    maxWidth: "100%",
  },
  askButton: {
    borderRadius: theme.radius.pill,
    backgroundColor: "#EFA0C0",
    ...theme.shadows.ctaPrimary,
    shadowColor: "#F7B7D6",
    shadowOpacity: 0.62,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 2 },
    elevation: 18,
    marginTop: 2,
    alignSelf: "center",
    width: "82%",
  },
  askButtonMuted: {
    ...theme.shadows.ctaMuted,
  },
  askButtonGradient: {
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.radius.pill,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  askButtonText: {
    color: "#FFF7EA",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 15,
    letterSpacing: 0.4,
    textAlign: "center",
  },
  askButtonTextMuted: {
    color: "#D8CFDF",
  },
});

function PulsingOracleBallHintIcon() {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.09, {
          duration: 820,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(1, {
          duration: 820,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View
      style={[styles.ballHintIconWrap, animatedStyle]}
      accessibilityElementsHidden
    >
    <Fingerprint size={42} color={theme.colors.gold} strokeWidth={1.6}/>
    </Animated.View>
  );
}
