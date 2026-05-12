import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { theme } from "../theme";

const DREAM_LOADING_BG = require("../../assets/dream/loading-screen-bg.jpg");
const DREAM_DECOR_1 = require("../../assets/dream/decor1.png");
const DREAM_DECOR_2 = require("../../assets/dream/decor2.png");
const DREAM_DECOR_3 = require("../../assets/dream/decor3.png");
const DREAM_DECOR_4 = require("../../assets/dream/decor4.png");

const LOADING_DOT_COUNT = 5;

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized.split("").map((ch) => ch + ch).join("")
      : normalized;
  const int = Number.parseInt(value, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function mixHex(from: string, to: string, t: number) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const clampT = Math.max(0, Math.min(1, t));
  const r = Math.round(a.r + (b.r - a.r) * clampT);
  const g = Math.round(a.g + (b.g - a.g) * clampT);
  const bChannel = Math.round(a.b + (b.b - a.b) * clampT);
  return `rgb(${r}, ${g}, ${bChannel})`;
}

function DreamLoadingDots() {
  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.linear }),
      -1,
      false,
    );
  }, [sweep]);

  return (
    <View style={styles.loadingDotsRow}>
      {Array.from({ length: LOADING_DOT_COUNT }, (_, i) => (
        <DreamLoadingDot key={i} index={i} sweep={sweep} />
      ))}
    </View>
  );
}

function DreamLoadingDot({
  index,
  sweep,
}: {
  index: number;
  sweep: SharedValue<number>;
}) {
  const isIos = Platform.OS === "ios";
  const style = useAnimatedStyle(() => {
    const pos = sweep.value * LOADING_DOT_COUNT;
    const d = Math.abs(pos - index);
    const wrapped = Math.min(d, LOADING_DOT_COUNT - d);
    const intensity = interpolate(
      wrapped,
      [0, 0.55, 1.35],
      [1, 0.38, 0.22],
      Extrapolation.CLAMP,
    );
    const bg = interpolateColor(intensity, [0, 1], ["#9333EA", "#F0ABFC"]);
    const glow = interpolate(
      intensity,
      [0.35, 1],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const base = {
      opacity: 0.42 + intensity * 0.48,
      backgroundColor: bg,
      transform: [{ scale: 0.86 + intensity * 0.34 }],
    };
    if (isIos) {
      return {
        ...base,
        shadowColor: "#F5D0FE",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: glow * 0.92,
        shadowRadius: 2 + glow * 5,
      };
    }
    return {
      ...base,
      elevation: glow * 9,
      shadowColor: "#F5D0FE",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: glow * 0.55,
      shadowRadius: 2 + glow * 8,
    };
  });

  return <Animated.View style={[styles.loadingDot, style]} />;
}

export default function DreamInterpretLoadingScreen() {
  const { height: windowH, width: windowW } = useWindowDimensions();
  const loadingBottomPad = Math.max(68, Math.round(windowH * 0.12));
  const loadingTitleWidth = Math.min(360, Math.max(240, windowW - 120));
  const [titleGradientPhase, setTitleGradientPhase] = useState(0);
  const decorLift1 = useSharedValue(0);
  const decorLift2 = useSharedValue(0);
  const decorLift3 = useSharedValue(0);
  const decorLift4 = useSharedValue(0);

  useEffect(() => {
    let phase = 0;
    const id = setInterval(() => {
      phase = (phase + 0.03) % 1;
      setTitleGradientPhase(phase);
    }, 60);
    return () => {
      clearInterval(id);
    };
  }, []);

  const shimmer = (Math.sin(titleGradientPhase * Math.PI * 2) + 1) / 2;
  const startColor = mixHex("#F9E7C8", "#D8C6FF", shimmer * 0.85);
  const middleColor = mixHex("#FFD79A", "#F7E6CB", shimmer);
  const endColor = mixHex("#D8C6FF", "#FFE2B8", shimmer * 0.9);

  useEffect(() => {
    decorLift1.value = withDelay(
      0,
      withRepeat(
        withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
    decorLift2.value = withDelay(
      900,
      withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
    decorLift3.value = withDelay(
      400,
      withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
    decorLift4.value = withDelay(
      1200,
      withRepeat(
        withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );

    return () => {
      cancelAnimation(decorLift1);
      cancelAnimation(decorLift2);
      cancelAnimation(decorLift3);
      cancelAnimation(decorLift4);
    };
  }, [decorLift1, decorLift2, decorLift3, decorLift4]);

  const decorAnim1 = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(decorLift1.value, [0, 1], [0, -16]) }],
  }));
  const decorAnim2 = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(decorLift2.value, [0, 1], [0, -21]) }],
  }));
  const decorAnim3 = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(decorLift3.value, [0, 1], [0, -17]) }],
  }));
  const decorAnim4 = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(decorLift4.value, [0, 1], [0, -24]) }],
  }));

  return (
    <View style={styles.loadingRoot} testID="dreambook-loading-screen">
      <Image
        source={DREAM_LOADING_BG}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="center"
      />
      <LinearGradient
        colors={[
          "rgba(14,10,31,0.08)",
          "rgba(14,10,31,0.2)",
          "rgba(14,10,31,0.84)",
          "rgba(14,10,31,0.96)",
        ]}
        locations={[0, 0.42, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.loadingDecor, styles.loadingDecorOne, decorAnim1]}>
        <Image source={DREAM_DECOR_1} style={styles.loadingDecorImage} contentFit="contain" />
      </Animated.View>
      <Animated.View style={[styles.loadingDecor, styles.loadingDecorTwo, decorAnim2]}>
        <Image source={DREAM_DECOR_2} style={styles.loadingDecorImage} contentFit="contain" />
      </Animated.View>
      <Animated.View style={[styles.loadingDecor, styles.loadingDecorThree, decorAnim3]}>
        <Image source={DREAM_DECOR_3} style={styles.loadingDecorImage} contentFit="contain" />
      </Animated.View>
      <Animated.View style={[styles.loadingDecor, styles.loadingDecorFour, decorAnim4]}>
        <Image source={DREAM_DECOR_4} style={styles.loadingDecorImage} contentFit="contain" />
      </Animated.View>

      <SafeAreaView
        style={[styles.loadingSafe, { paddingBottom: loadingBottomPad }]}
        edges={["top", "bottom"]}
      >
        <View style={styles.loadingTextBlock}>
          <View style={styles.loadingTitleRow}>
            <Text style={styles.loadingSideStar}>✦</Text>
            <View style={[styles.loadingTitle, { width: loadingTitleWidth }]}>
              <Svg width={loadingTitleWidth} height={52} viewBox={`0 0 ${loadingTitleWidth} 52`}>
                <Defs>
                  <SvgLinearGradient
                    id="dreamLoadingTitleGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <Stop offset="0%" stopColor={startColor} />
                    <Stop offset="42%" stopColor={middleColor} />
                    <Stop offset="100%" stopColor={endColor} />
                  </SvgLinearGradient>
                </Defs>
                <SvgText
                  x="50%"
                  y="40"
                  textAnchor="middle"
                  fill="url(#dreamLoadingTitleGradient)"
                  fontSize="42"
                  fontFamily={theme.fonts.heading}
                >
                  Расшифровка...
                </SvgText>
              </Svg>
            </View>
            <Text style={styles.loadingSideStar}>✦</Text>
          </View>
          <View style={styles.loadingDivider}>
            <View style={styles.loadingDividerLine} />
            <Text style={styles.loadingDividerStar}>✦</Text>
            <View style={styles.loadingDividerLine} />
          </View>
          <DreamLoadingDots />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    backgroundColor: "#0F0A23",
    overflow: "hidden",
  },
  loadingSafe: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 28,
  },
  loadingDecor: {
    position: "absolute",
    top: -6,
  },
  loadingDecorImage: {
    width: "100%",
    height: "100%",
  },
  loadingDecorOne: {
    left: 4,
    width: 74,
    height: 252,
  },
  loadingDecorTwo: {
    left: "14%",
    width: 58,
    height: 202,
  },
  loadingDecorThree: {
    right: "14%",
    width: 54,
    height: 220,
  },
  loadingDecorFour: {
    right: 4,
    width: 84,
    height: 272,
  },
  loadingTextBlock: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  loadingTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingSideStar: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.heading,
    fontSize: 18,
    lineHeight: 24,
    opacity: 0.92,
  },
  loadingTitle: {
    alignItems: "center",
    justifyContent: "center",
  },
  loadingDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    opacity: 0.72,
  },
  loadingDividerLine: {
    width: 88,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.borderGold,
  },
  loadingDividerStar: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.heading,
    fontSize: 16,
    lineHeight: 20,
  },
  loadingDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 22,
    paddingVertical: 14,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,215,154,0.22)",
  },
});
