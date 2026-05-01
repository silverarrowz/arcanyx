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
};

export default function GlassCard({
  children,
  style,
  intensity = 28,
  tint = "dark",
  borderColor,
  glow = "none",
}: Props) {
  const glowStyle =
    glow === "gold"
      ? styles.glowGold
      : glow === "purple"
      ? styles.glowPurple
      : null;

  return (
    <View style={[styles.wrapper, glowStyle, style]}>
      <BlurView
        intensity={intensity}
        tint={tint}
        style={[
          styles.inner,
          { borderColor: borderColor ?? theme.colors.border },
        ]}
      >
        <View style={styles.bgOverlay} />
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
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(35,31,58,0.74)",
  },
  glowGold: {
    ...theme.shadows.glowGold,
  },
  glowPurple: {
    ...theme.shadows.glowPurple,
  },
});
