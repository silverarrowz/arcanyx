import React, { useEffect, useMemo } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { theme } from "../theme";

type Props = {
  /** How many tiny sparkles to render. */
  count?: number;
  /** Bounding container size in px (square). */
  size?: number;
  /** Disable animations (reduced-motion). Stars are still rendered, statically. */
  reduceMotion?: boolean;
  /** Optional override style for the wrapper. */
  style?: ViewStyle | ViewStyle[];
};

type Spec = {
  cx: number; // center x in container coords (0..size)
  cy: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
};

/**
 * Decorative twinkling sparkles used around the revealed card during the
 * draw ritual. Pure-presentational — no animation when reduceMotion is true.
 */
export default function Sparkles({
  count = 8,
  size = 220,
  reduceMotion = false,
  style,
}: Props) {
  const specs = useMemo<Spec[]>(() => {
    const arr: Spec[] = [];
    const colors = [
      theme.colors.gold,
      "#FFF7EA",
      theme.colors.mauve,
      theme.colors.pink,
    ];
    for (let i = 0; i < count; i++) {
      arr.push({
        cx: Math.random() * size,
        cy: Math.random() * size,
        size: 3 + Math.random() * 4,
        delay: Math.floor(Math.random() * 800),
        duration: 900 + Math.floor(Math.random() * 700),
        color: colors[i % colors.length],
      });
    }
    return arr;
  }, [count, size]);

  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      {specs.map((s, idx) => (
        <Spark key={idx} spec={s} reduceMotion={reduceMotion} />
      ))}
    </View>
  );
}

function Spark({ spec, reduceMotion }: { spec: Spec; reduceMotion: boolean }) {
  const progress = useSharedValue(reduceMotion ? 0.6 : 0);
  const haloSize = spec.size * 3.4;
  const gradientId = `sparkGlow_${Math.round(spec.cx)}_${Math.round(spec.cy)}_${spec.delay}`;

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withDelay(
      spec.delay,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: spec.duration / 2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0, {
            duration: spec.duration / 2,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion, spec.delay, spec.duration]);

  const aStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + progress.value * 0.62,
    transform: [{ scale: 0.72 + progress.value * 0.5 }],
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          left: spec.cx - haloSize / 2,
          top: spec.cy - haloSize / 2,
          width: haloSize,
          height: haloSize,
          borderRadius: haloSize / 2,
          shadowColor: spec.color,
        },
        aStyle,
      ]}
    >
      <Svg width={haloSize} height={haloSize}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={spec.color} stopOpacity={0.9} />
            <Stop offset="24%" stopColor={spec.color} stopOpacity={0.55} />
            <Stop offset="56%" stopColor={spec.color} stopOpacity={0.2} />
            <Stop offset="100%" stopColor={spec.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.62,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
});
