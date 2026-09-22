import React, { useState } from "react";
import { Platform, View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { BlurView, type BlurTint } from "expo-blur";
import { theme } from "../theme";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: BlurTint;
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
  const overCol = overlayColor ?? "rgba(26,24,36,0.74)";
  const [backdropSize, setBackdropSize] = useState({ width: 0, height: 0 });

  if (allowOverflow) {
    const measured = backdropSize.width > 0 && backdropSize.height > 0;
    const frostOnNative = Platform.OS !== "web";
    return (
      <View style={[styles.wrapper, glowStyle, style]} pointerEvents="box-none">
        <View
          style={[
            styles.overflowShell,
            { borderColor: borderCol },
            frostOnNative ? styles.overflowShellNativeFrost : null,
          ]}
          pointerEvents="box-none"
        >
          {/* iOS BlurView in a content-sized overlay paints a dark strip — tint the
              hero instead, so the nebula shows through as matte glass. */}
          <View
            style={[
              styles.overflowBackdropClip,
              measured
                ? { width: backdropSize.width, height: backdropSize.height }
                : styles.overflowBackdropFallback,
            ]}
            pointerEvents="none"
          >
            {frostOnNative ? (
              <View style={[styles.overflowBlurFill, { backgroundColor: surfCol }]} />
            ) : (
              <BlurView
                intensity={intensity}
                tint={tint}
                style={[styles.overflowBlurFill, { backgroundColor: surfCol }]}
              />
            )}
            <View style={[styles.bgOverlay, { backgroundColor: overCol }]} pointerEvents="none" />
          </View>
          <View
            style={styles.overflowForeground}
            pointerEvents="box-none"
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setBackdropSize((prev) =>
                prev.width === width && prev.height === height
                  ? prev
                  : { width, height },
              );
            }}
          >
            {children}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, glowStyle, style]} pointerEvents="box-none">
      <BlurView
        intensity={intensity}
        tint={tint}
        blurMethod="dimezisBlurView"
        pointerEvents="box-none"
        style={[
          styles.inner,
          {
            borderColor: borderCol,
            // Fill on UIVisualEffectView kills iOS frost; keep the wash in the overlay.
            backgroundColor: Platform.OS === "ios" ? "transparent" : surfCol,
          },
        ]}
      >
        <View style={[styles.bgOverlay, { backgroundColor: overCol }]} pointerEvents="none" />
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
  overflowShellNativeFrost: {
    backgroundColor: "rgba(20, 18, 28, 0.42)",
  },
  overflowBackdropClip: {
    position: "absolute",
    top: 0,
    left: 0,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
  },
  overflowBackdropFallback: {
    right: 0,
    bottom: 0,
  },
  overflowBlurFill: {
    ...StyleSheet.absoluteFill,
  },
  overflowForeground: {
    overflow: "visible",
  },
  bgOverlay: {
    ...StyleSheet.absoluteFill,
  },
  glowGold: {
    ...theme.shadows.glowGold,
  },
  glowPurple: {
    ...theme.shadows.glowPurple,
  },
});
