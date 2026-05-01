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
import { PenLine, Sparkles } from "lucide-react-native";
import { theme } from "../../src/theme";
import CosmicBackground from "../../src/components/CosmicBackground";
import GlassCard from "../../src/components/GlassCard";
import {
  CATEGORY_META,
  ORACLE_SOURCE_META,
  ORACLE_SOURCES,
  getRandomOracleAnswer,
  OracleCategory,
  OracleSource,
} from "../../src/data/oracleAnswers";
import { useHistory } from "../../src/context/HistoryContext";

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

export default function OracleScreen() {
  const { width: screenW } = Dimensions.get("window");
  const heroHeight = screenW / BALL_ASPECT_RATIO;

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
  const resultSourceMeta = result
    ? ORACLE_SOURCE_META[result.source]
    : activeSourceMeta;

  const mistOrbSize = screenW * 1.18;

  return (
    <View style={styles.root}>
      <CosmicBackground />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.hero, { height: heroHeight }]}>
                <Animated.View style={styles.heroImageLayer}>
                  <Image
                    source={BALL_IMAGE}
                    style={styles.heroImage}
                    resizeMode="cover"
                  />
                </Animated.View>
                <View style={styles.particleLayer} pointerEvents="none">
                  {ORACLE_PARTICLES.map((particle, index) => (
                    <OracleParticle key={index} {...particle} />
                  ))}
                </View>
                <LinearGradient
                  colors={[
                    "rgba(18,16,34,0.18)",
                    "rgba(18,16,34,0.08)",
                    theme.colors.bg,
                  ]}
                  locations={[0, 0.68, 1]}
                  style={styles.heroFade}
                  pointerEvents="none"
                />
                <View style={styles.heroCopy}>
                  <Text style={styles.eyebrow}>ORACLE BALL</Text>
                  <View style={styles.heroDivider}>
                    <View style={styles.heroDividerLine} />
                    <Text style={styles.heroDividerStar}>✦</Text>
                    <View style={styles.heroDividerLine} />
                  </View>
                  <Text style={styles.title}>Ask the Oracle</Text>
                  <Text style={styles.subtitle}>
                    Focus on your question and let the Oracle reveal the answer.
                  </Text>
                </View>

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

                {phase === "result" && result && meta && (
                  <Animated.View style={[styles.answerOverlay, answerWrapStyle]}>
                   
                    <Text style={styles.answerOnBall} testID="oracle-answer">
                      «{result.answer}»
                    </Text>
                  </Animated.View>
                )}
              </View>

              <View style={styles.content}>
                <GlassCard
                  borderColor={theme.colors.borderPurple}
                  style={styles.inputCard}
                >
                  <View style={styles.inputLabelRow}>
                    <Sparkles color={theme.colors.gold} size={14} />
                    <Text style={styles.inputLabel}>Твой вопрос</Text>
                  </View>
                  <View style={styles.inputInner}>
                    <TextInput
                      testID="oracle-input"
                      value={question}
                      onChangeText={setQuestion}
                      placeholder="Стоит ли начинать этот проект?"
                      placeholderTextColor={theme.colors.textDim}
                      style={styles.input}
                      multiline
                      editable={phase !== "loading"}
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
                    phase === "loading" && { opacity: 0.6 },
                    pressed && { transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <LinearGradient
                    colors={[theme.colors.pink, theme.colors.mauve]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.askButtonGradient}
                  >
                    <Sparkles color={theme.colors.text} size={18} />
                    <Text style={styles.askButtonText}>
                      {phase === "loading"
                        ? `Слушаю: ${activeSourceMeta.shortLabel}…`
                        : phase === "result"
                          ? "Задать новый вопрос"
                          : "Ask the Oracle"}
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
                        disabled={phase === "loading"}
                        onPress={() => {
                          setSelectedSource(source.id);
                          Haptics.selectionAsync().catch(() => {});
                        }}
                        style={({ pressed }) => [
                          styles.sourceCard,
                          selected && styles.sourceCardActiveGlow,
                          selected && { shadowColor: source.color },
                          pressed && { transform: [{ scale: 0.98 }] },
                          phase === "loading" && { opacity: 0.55 },
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

              <View style={{ height: 140 }} />
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  scroll: { paddingTop: 0 },
  hero: {
    width: "100%",
    overflow: "hidden",
  },
  heroImageLayer: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
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
    paddingTop: 28,
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
    marginBottom: 26,
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
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 260,
  },
  content: {
    paddingHorizontal: 24,
    marginTop: -62,
  },
  inputCard: {
    marginBottom: 20,
    borderRadius: 22,
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
    paddingTop: 0,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 999,
    marginBottom: 12,
  },
  categoryText: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 2,
  },
  categoryHint: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 10,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  answerOnBall: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 21,
    lineHeight: 28,
    fontStyle: "italic",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
    maxWidth: "50%",
  },
  answerSubOnBall: {
    color: "rgba(247,244,238,0.82)",
    fontSize: 10,
    fontFamily: theme.fonts.body,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginTop: 14,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  askButton: {
    borderRadius: theme.radius.pill,
    overflow: "hidden",
    shadowColor: theme.colors.mauve,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 6,
    marginTop: 2,
    alignSelf: "center",
    width: "82%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  askButtonGradient: {
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  askButtonText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 15,
    letterSpacing: 0.4,
    textAlign: "center",
  },
});
