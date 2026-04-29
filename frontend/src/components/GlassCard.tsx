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
  intensity = 30,
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
  },
  inner: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(21, 23, 34, 0.55)",
  },
  glowGold: {
    shadowColor: theme.colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  glowPurple: {
    shadowColor: theme.colors.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 14,
  },
});
