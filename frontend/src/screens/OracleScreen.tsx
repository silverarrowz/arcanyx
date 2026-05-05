import React, { useEffect, useState } from "react";
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
  Image,
  Dimensions,
  type DimensionValue,
} from "react-native";
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
import * as Haptics from "expo-haptics";
import { PenLine, Sparkles, Fingerprint } from "lucide-react-native";
import { theme } from "../theme";
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
const ballResolved =
  typeof (Image as any).resolveAssetSource === "function"
    ? (Image as any).resolveAssetSource(BALL_IMAGE)
    : null;
const BALL_ASPECT_RATIO =
  ballResolved?.width && ballResolved?.height
    ? ballResolved.width / ballResolved.height
    : 0.75;

/** Шар ниже в кадре: доля ширины экрана (якорь картинки + туман/частицы). ↑ = ниже. ~0.12–0.22 */
const ORACLE_BALL_VERTICAL_NUDGE = 0;
/** Поднять текст ответа на шаре (доля ширины экрана; только ответ, не шар). ↑ = выше. */
const ORACLE_ANSWER_LIFT_Y = 0;
/** Опустить туман относительно героя (доля screenW; только туман, не частицы). ↑ = ниже. */
const ORACLE_MIST_EXTRA_DOWN = 0.08;
/** Компактность полосы с шаром: меньше — меньше высота героя (больше места под форму). */
const ORACLE_HERO_HEIGHT_FRAC = 0.9;
const ORACLE_HERO_MAX_SCREEN_FRAC = 0.86;
/** Круговая зона long-press на шаре: доля ширины экрана и героя; ↑ = крупнее hit-target. */
const ORACLE_BALL_HIT_SIZE_FRAC_W = 0.76;
const ORACLE_BALL_HIT_MAX_FRAC_HERO_H = 0.52;
const ORACLE_BALL_HIT_BOTTOM_FRAC = 0.28;
const ORACLE_BALL_LONG_PRESS_MS = 450;

const ORACLE_SOURCE_BACKGROUNDS: Record<OracleSource, number> = {
  universe: require("../../assets/oracle/bg1.png"),
  innerSelf: require("../../assets/oracle/bg2.png"),
  shadow: require("../../assets/oracle/bg3.png"),
};

/** Seamless loop for mist hue animation */
const MIST_CYCLE = ["#9D7CE6", "#FFD79A", "#EFA0C0", "#C47BEA", "#9D7CE6"];

const MIST_KEYFRAMES = [0, 0.25, 0.5, 0.75];
const MIST_COLORS = MIST_CYCLE.slice(0, -1);

const ORACLE_PARTICLES = [
  { top: "20%", left: "10%", size: 2, delay: 0, duration: 2600 },
  { top: "24%", left: "88%", size: 2, delay: 420, duration: 3200 },
  { top: "34%", left: "8%", size: 2, delay: 760, duration: 2800 },
  { top: "38%", left: "92%", size: 2, delay: 1100, duration: 3000 },
  { top: "52%", left: "6%", size: 2, delay: 360, duration: 3400 },
  { top: "56%", left: "94%", size: 2, delay: 900, duration: 2900 },
  { top: "70%", left: "12%", size: 2, delay: 1280, duration: 3100 },
  { top: "74%", left: "88%", size: 2, delay: 620, duration: 2700 },
  { top: "82%", left: "24%", size: 2, delay: 1480, duration: 3300 },
  { top: "84%", left: "76%", size: 2, delay: 180, duration: 3000 },
] satisfies readonly {
  top: DimensionValue;
  left: DimensionValue;
  size: number;
  delay: number;
  duration: number;
}[];

function OracleParticle({
  top,
  left,
  size,
  delay,
  duration,
}: {
  top: DimensionValue;
  left: DimensionValue;
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

function RadialMistSvg({
  size,
  color,
  id,
}: {
  size: number;
  color: string;
  id: string;
}) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="44%" r="44%">
          <Stop offset="0%" stopColor={color} stopOpacity={0.97} />
          <Stop offset="24%" stopColor={color} stopOpacity={0.7} />
          <Stop offset="46%" stopColor={color} stopOpacity={0.3} />
          <Stop offset="82%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

function CycleMistLayer({
  size,
  color,
  index,
  fogHue,
}: {
  size: number;
  color: string;
  index: number;
  fogHue: SharedValue<number>;
}) {
  const layerStyle = useAnimatedStyle(() => {
    const distance = Math.abs(fogHue.value - MIST_KEYFRAMES[index]);
    const wrappedDistance = Math.min(distance, 1 - distance);

    return {
      opacity: Math.min(1, Math.max(0, 1 - wrappedDistance / 0.22) * 1.22),
    };
  });

  return (
    <Animated.View style={[styles.mistSvgLayer, layerStyle]}>
      <RadialMistSvg size={size} color={color} id={`oracleCycleMist${index}`} />
    </Animated.View>
  );
}

/** True feathered mist: SVG gradient edges, Reanimated only fades host views. */
function CyclingRadialMist({
  size,
  fogHue,
  loadingLayer,
}: {
  size: number;
  fogHue: SharedValue<number>;
  loadingLayer: SharedValue<number>;
}) {
  const wrapStyle = useAnimatedStyle(() => ({
    opacity: loadingLayer.value,
  }));

  return (
    <View style={styles.mistOverlay} pointerEvents="none">
      <Animated.View style={[styles.mistOverlayFlex, wrapStyle]}>
        <View style={{ width: size, height: size }}>
          {MIST_COLORS.map((color, index) => (
            <CycleMistLayer
              key={color}
              size={size}
              color={color}
              index={index}
              fogHue={fogHue}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

function AccentRadialMist({
  size,
  color,
  resultLayer,
}: {
  size: number;
  color: string;
  resultLayer: SharedValue<number>;
}) {
  const wrapStyle = useAnimatedStyle(() => ({
    opacity: resultLayer.value,
  }));

  return (
    <View style={styles.mistOverlay} pointerEvents="none">
      <Animated.View style={[styles.mistOverlayFlex, wrapStyle]}>
        <View style={{ width: size, height: size }}>
          <RadialMistSvg size={size} color={color} id="oracleAccentMist" />
        </View>
      </Animated.View>
    </View>
  );
}

type OracleScreenProps = {
  /** When true, top safe area is handled by the parent (e.g. Gadania segment header). */
  embedded?: boolean;
};

export default function OracleScreen({ embedded = false }: OracleScreenProps) {
  const { width: screenW, height: screenH } = Dimensions.get("window");
  const heroNatural = screenW / BALL_ASPECT_RATIO;
  const heroHeight = Math.min(
    heroNatural * ORACLE_HERO_HEIGHT_FRAC,
    screenH * ORACLE_HERO_MAX_SCREEN_FRAC,
  );
  const heroImageNudgeY = screenW * ORACLE_BALL_VERTICAL_NUDGE;

  const { addItem } = useHistory();
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [selectedSource, setSelectedSource] =
    useState<OracleSource>("universe");
  const [result, setResult] = useState<{
    category: OracleCategory;
    answer: string;
    source: OracleSource;
  } | null>(null);

  const breathing = useSharedValue(1);
  const fogHue = useSharedValue(0);
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
      fogHue.value = withRepeat(
        withTiming(1, { duration: 5500, easing: Easing.linear }),
        -1,
        false,
      );
    } else if (phase === "result") {
      cancelAnimation(fogHue);
      fogHue.value = withTiming(0, { duration: 400 });
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
      cancelAnimation(fogHue);
      fogHue.value = withTiming(0, { duration: 320 });
      loadingLayer.value = withTiming(0, { duration: 380 });
      resultLayer.value = withTiming(0, { duration: 320 });
      answerOpacity.value = withTiming(0, { duration: 220 });
    }
  }, [phase, fogHue, loadingLayer, resultLayer, answerOpacity]);

  const answerLiftPx = screenW * ORACLE_ANSWER_LIFT_Y;

  const answerWrapStyle = useAnimatedStyle(() => ({
    opacity: answerOpacity.value,
    transform: [
      {
        translateY:
          heroImageNudgeY -
          answerLiftPx +
          (1 - answerOpacity.value) * 12,
      },
    ],
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
      const trimmed = question.trim() || "Без вопроса";
      addItem({
        type: "oracle",
        question: trimmed,
        answer: r.answer,
        category: r.category,
        oracleSource: r.source,
        oracleSourceLabel: ORACLE_SOURCE_META[r.source].label,
        outcome: null,
      });
    }, 2200);
  };

  const reset = () => {
    setPhase("idle");
    setResult(null);
    setQuestion("");
  };

  const meta = result ? CATEGORY_META[result.category] : null;
  const activeSourceMeta = ORACLE_SOURCE_META[selectedSource];
  /** Only idle: question/source are fixed once the user asks until they start a new round. */
  const formUnlocked = phase === "idle";
  const resultSourceMeta = result
    ? ORACLE_SOURCE_META[result.source]
    : activeSourceMeta;

  const mistOrbSize = screenW * 1.18;
  const mistShiftY =
    heroImageNudgeY + screenW * ORACLE_MIST_EXTRA_DOWN;

  const ballHitSize = Math.min(
    screenW * ORACLE_BALL_HIT_SIZE_FRAC_W,
    heroHeight * ORACLE_BALL_HIT_MAX_FRAC_HERO_H,
  );
  const ballHitBottom = heroHeight * ORACLE_BALL_HIT_BOTTOM_FRAC;

  const onBallLongPress = () => {
    if (phase === "loading") return;
    if (phase === "result") {
      reset();
    } else {
      askUniverse();
    }
  };

  return (
    <View style={styles.root}>
      <CosmicBackground />
      <SafeAreaView
        style={styles.safe}
        edges={embedded ? ["bottom"] : ["top"]}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView
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
                    resizeMode="cover"
                  />
                </Animated.View>
                <View
                  style={[
                    styles.heroBallShift,
                    { transform: [{ translateY: heroImageNudgeY }] },
                  ]}
                  pointerEvents="none"
                >
                  <View style={styles.particleLayer} pointerEvents="none">
                    {ORACLE_PARTICLES.map((particle, index) => (
                      <OracleParticle key={index} {...particle} />
                    ))}
                  </View>
                </View>
                {/* Bottom: image → bg (same feather as before, top stays clear for the top fade) */}
                <LinearGradient
                  colors={[
                    "rgba(18,16,34,0)",
                    "rgba(18,16,34,0.08)",
                    theme.colors.bg,
                  ]}
                  locations={[0, 0.68, 1]}
                  style={styles.heroFade}
                  pointerEvents="none"
                />
                {/* Top: bg → transparent, mirrors the bottom blend into theme bg */}
                <LinearGradient
                  colors={[theme.colors.bg, "rgba(18,16,34,0)"]}
                  locations={[0, 1]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.32 }}
                  style={styles.heroFade}
                  pointerEvents="none"
                />
                <View style={styles.heroCopy}>
                  {/* <Text style={styles.eyebrow}>ORACLE BALL</Text> */}
                  <View style={styles.heroDivider}>
                    <View style={styles.heroDividerLine} />
                    <Text style={styles.heroDividerStar}>✦</Text>
                    <View style={styles.heroDividerLine} />
                  </View>
                  <Text style={styles.title}>Спроси Оракула</Text>
                  <Text style={styles.subtitle}>
                   Задай вопрос, на который можно ответить &quot;да&quot; или &quot;нет&quot;
                  </Text>
                </View>

                <View
                  style={[
                    styles.heroBallShift,
                    { transform: [{ translateY: mistShiftY }] },
                  ]}
                  pointerEvents="none"
                >
                  <CyclingRadialMist
                    size={mistOrbSize}
                    fogHue={fogHue}
                    loadingLayer={loadingLayer}
                  />

                  {meta && (
                    <AccentRadialMist
                      size={mistOrbSize}
                      color={resultSourceMeta.aura}
                      resultLayer={resultLayer}
                    />
                  )}
                </View>

                {phase === "result" && result && meta && (
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.answerOverlay, answerWrapStyle]}
                  >
                    <Text style={styles.answerOnBall} testID="oracle-answer">
                      {result.answer}
                    </Text>
                  </Animated.View>
                )}

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
                    <Text style={styles.ballHintLabel}>Нажми и удерживай</Text>
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
                        : "Сформулируй вопрос"}
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
                        <View style={styles.sourceCardInner}>
                          <View style={styles.sourceCardBody}>
                            <Image
                              source={ORACLE_SOURCE_BACKGROUNDS[source.id]}
                              style={[
                                styles.sourceCardImage,
                                { opacity: selected ? 0.58 : 0.34 },
                              ]}
                              resizeMode="cover"
                            />
                            <LinearGradient
                              colors={[
                                "rgba(18,16,34,0.18)",
                                selected
                                  ? source.color + "30"
                                  : "rgba(18,16,34,0.18)",
                                "rgba(18,16,34,0.9)",
                              ]}
                              locations={[0, 0.42, 1]}
                              start={{ x: 1, y: 0 }}
                              end={{ x: 0, y: 1 }}
                              style={styles.sourceCardImageOverlay}
                            />
                            <View style={styles.sourceCardContent}>
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
                            </View>
                          </View>
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

/** Общая типографика текста на шаре (ответ и подсказка «удерживай»). */
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
  /** Частицы и туман: тот же вертикальный сдвиг, что и визуально у шара после anchor. */
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
    ...StyleSheet.absoluteFillObject,
  },
  heroCopy: {
    paddingHorizontal: 24,
    paddingTop: 14,
    alignItems: "center",
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
    maxWidth: 200,
  },
  content: {
    paddingHorizontal: 24,
    marginTop: -64,
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
    minHeight: 74,
    borderRadius: 24,
    overflow: "visible",
  },
  sourceCardInner: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceGlass,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sourceCardActiveGlow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 14,
    elevation: 8,
  },
  sourceCardBody: {
    flex: 1,
    minHeight: 94,
    justifyContent: "center",
  },
  sourceCardImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  sourceCardImageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  sourceCardContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 108,
  },
  sourceLabel: {
    fontFamily: theme.fonts.display,
    fontSize: 22,
    letterSpacing: 0.1,
    marginBottom: 5,
  },
  sourceSubtitle: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 16,
  },
  mistSvgLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  mistOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  mistOverlayFlex: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  answerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
    marginTop: -20,
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
    fontSize: 18,
    lineHeight: 20,
    marginTop: 20,
    maxWidth: "40%",
  },
  answerOnBall: {
    ...oracleBallTextBase,
    maxWidth: "40%",
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
