import React from "react";
import {
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
  type DimensionValue,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../theme";

type GradientStops = readonly [string, string, ...string[]];

type Props = {
  style?: StyleProp<ViewStyle>;
  variant?: "default" | "tarot" | "dream";
};

/**
 * Layered backdrops: a vertical wash, a dome of light over the header, three
 * full-bleed accent glows and faint dust. Glows are full-bleed on purpose —
 * a bounded blob shows a visible arc where its edge crosses the screen.
 */
type Palette = {
  base: GradientStops;
  dome: GradientStops;
  glowTopRight: GradientStops;
  glowBottomLeft: GradientStops;
  glowBottomRight: GradientStops;
};

/** App-wide wash — one desaturated indigo, no pink or gold. */
const DEFAULT_PALETTE: Palette = {
  base: ["#13111E", "#0C0B11", "#0C0B11", "#0A0910"],
  dome: [
    "rgba(44,35,64,0.28)",
    "rgba(44,35,64,0.08)",
    "rgba(12,11,17,0)",
  ],
  glowTopRight: [
    "rgba(44,35,64,0.14)",
    "rgba(44,35,64,0.04)",
    "rgba(12,11,17,0)",
  ],
  glowBottomLeft: [
    "rgba(44,35,64,0.12)",
    "rgba(44,35,64,0.04)",
    "rgba(12,11,17,0)",
  ],
  glowBottomRight: [
    "rgba(44,35,64,0.08)",
    "rgba(44,35,64,0.02)",
    "rgba(12,11,17,0)",
  ],
};

const PALETTES: Record<"tarot" | "dream", Palette> = {
  tarot: {
    base: ["#1A1824", "#13111E", "#0C0B11", "#0A0910"],
    dome: [
      "rgba(60,48,88,0.32)",
      "rgba(44,35,64,0.12)",
      "rgba(12,11,17,0)",
    ],
    glowTopRight: [
      "rgba(60,48,88,0.18)",
      "rgba(44,35,64,0.06)",
      "rgba(12,11,17,0)",
    ],
    glowBottomLeft: [
      "rgba(60,48,88,0.14)",
      "rgba(44,35,64,0.05)",
      "rgba(12,11,17,0)",
    ],
    glowBottomRight: [
      "rgba(60,48,88,0.1)",
      "rgba(44,35,64,0.03)",
      "rgba(12,11,17,0)",
    ],
  },
  /** Moonlit indigo — cooler than the tarot violet so the dream flow reads apart. */
  dream: {
    base: ["#161422", "#11101A", "#0C0B11", "#0A0910"],
    dome: [
      "rgba(52,48,88,0.3)",
      "rgba(44,40,72,0.11)",
      "rgba(12,11,17,0)",
    ],
    glowTopRight: [
      "rgba(52,48,88,0.16)",
      "rgba(44,40,72,0.05)",
      "rgba(12,11,17,0)",
    ],
    glowBottomLeft: [
      "rgba(52,48,88,0.12)",
      "rgba(44,40,72,0.04)",
      "rgba(12,11,17,0)",
    ],
    glowBottomRight: [
      "rgba(52,48,88,0.08)",
      "rgba(44,40,72,0.03)",
      "rgba(12,11,17,0)",
    ],
  },
};

/** Static dust so the deep areas never read as flat black. */
const STAR_DUST: {
  top: DimensionValue;
  left: DimensionValue;
  size: number;
  opacity: number;
}[] = [
  { top: "5%", left: "14%", size: 2, opacity: 0.5 },
  { top: "9%", left: "72%", size: 3, opacity: 0.34 },
  { top: "14%", left: "38%", size: 2, opacity: 0.24 },
  { top: "21%", left: "88%", size: 2, opacity: 0.42 },
  { top: "27%", left: "8%", size: 3, opacity: 0.28 },
  { top: "34%", left: "56%", size: 2, opacity: 0.2 },
  { top: "41%", left: "24%", size: 2, opacity: 0.36 },
  { top: "48%", left: "82%", size: 3, opacity: 0.24 },
  { top: "55%", left: "46%", size: 2, opacity: 0.18 },
  { top: "62%", left: "16%", size: 2, opacity: 0.3 },
  { top: "69%", left: "76%", size: 2, opacity: 0.22 },
  { top: "77%", left: "34%", size: 3, opacity: 0.2 },
  { top: "84%", left: "64%", size: 2, opacity: 0.26 },
  { top: "91%", left: "22%", size: 2, opacity: 0.16 },
];

export default function CosmicBackground({
  style,
  variant = "default",
}: Props) {
  const palette = variant === "default" ? DEFAULT_PALETTE : PALETTES[variant];

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.container, style]}
    >
      <>
          <LinearGradient
            colors={palette.base}
            locations={[0, 0.38, 0.74, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={palette.dome}
            locations={[0, 0.5, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.topDome}
          />
          <LinearGradient
            colors={palette.glowTopRight}
            locations={[0, 0.34, 0.72]}
            start={{ x: 1, y: 0.04 }}
            end={{ x: 0.1, y: 0.62 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={palette.glowBottomLeft}
            locations={[0, 0.3, 0.66]}
            start={{ x: 0, y: 1 }}
            end={{ x: 0.86, y: 0.24 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={palette.glowBottomRight}
            locations={[0, 0.26, 0.58]}
            start={{ x: 0.9, y: 1 }}
            end={{ x: 0.2, y: 0.3 }}
            style={StyleSheet.absoluteFill}
          />
          {variant !== "default"
            ? STAR_DUST.map((star, index) => (
                <View
                  key={`dust-${index}`}
                  style={[
                    styles.star,
                    {
                      top: star.top,
                      left: star.left,
                      width: star.size,
                      height: star.size,
                      borderRadius: star.size / 2,
                      opacity: star.opacity * 0.55,
                    },
                  ]}
                />
              ))
            : null}
          <LinearGradient
            colors={["rgba(12,11,17,0)", "rgba(12,11,17,0.45)", "rgba(10,9,16,0.88)"]}
            locations={[0, 0.55, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.bottomVeil}
          />
      </>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.bg,
    overflow: "hidden",
  },
  /** Sits above the top edge so only its transparent falloff is on screen. */
  topDome: {
    position: "absolute",
    top: -230,
    left: "-30%",
    width: "160%",
    height: 520,
    borderRadius: 999,
  },
  star: {
    position: "absolute",
    backgroundColor: theme.colors.text,
  },
  bottomVeil: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 190,
  },
});
