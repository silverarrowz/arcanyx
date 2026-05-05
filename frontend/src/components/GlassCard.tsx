import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { BlurView } from "expo-blur";
import { theme } from "../theme";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: "dark" | "light" | "default";
  borderColor?: string;
  glow?: "gold" | "purple" | "none";
  surfaceColor?: string;
  overlayColor?: string;
  /**
   * Default clips children to the rounded glass rect. When true, blur sits in an
   * absolute layer with overflow hidden while children render in a sibling with
   * overflow visible (native BlurView otherwise clips decorations like soft glows).
   */
  allowOverflow?: boolean;
};

export default function GlassCard({
  children,
  style,
  intensity = 28,
  tint = "dark",
  borderColor,
  glow = "none",
  surfaceColor,
  overlayColor,
  allowOverflow = false,
}: Props) {
  const glowStyle =
    glow === "gold"
      ? styles.glowGold
      : glow === "purple"
        ? styles.glowPurple
        : null;

  const borderCol = borderColor ?? theme.colors.border;
  const surfCol = surfaceColor ?? theme.colors.surfaceGlass;
  const overCol = overlayColor ?? "rgba(35,31,58,0.74)";

  if (allowOverflow) {
    return (
      <View style={[styles.wrapper, glowStyle, style]}>
        <View style={[styles.overflowShell, { borderColor: borderCol }]}>
          {/* Native BlurView often ignores borderRadius — clip blur + tint in a rounded View. */}
          <View style={styles.overflowBackdropClip}>
            <BlurView
              intensity={intensity}
              tint={tint}
              style={[styles.overflowBlurFill, { backgroundColor: surfCol }]}
            />
            <View style={[styles.bgOverlay, { backgroundColor: overCol }]} pointerEvents="none" />
          </View>
          <View style={styles.overflowForeground}>{children}</View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, glowStyle, style]}>
      <BlurView
        intensity={intensity}
        tint={tint}
        style={[
          styles.inner,
          {
            borderColor: borderCol,
            backgroundColor: surfCol,
          },
        ]}
      >
        <View style={[styles.bgOverlay, { backgroundColor: overCol }]} />
        {children}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: theme.radius.lg,
    overflow: "visible",
    ...theme.shadows.card,
  },
  inner: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceGlass,
  },
  /** Shell when children may extend past the rounded rect (glows, particles). */
  overflowShell: {
    position: "relative",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    overflow: "visible",
  },
  overflowBackdropClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
  },
  overflowBlurFill: {
    ...StyleSheet.absoluteFillObject,
  },
  overflowForeground: {
    overflow: "visible",
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  glowGold: {
    ...theme.shadows.glowGold,
  },
  glowPurple: {
    ...theme.shadows.glowPurple,
  },
});
