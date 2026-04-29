import React from "react";
import { StyleSheet, View, ViewStyle, StyleProp } from "react-native";
import { theme } from "../theme";

type Props = {
  style?: StyleProp<ViewStyle>;
};

// Decorative blurred glow orbs in the background
export default function CosmicBackground({ style }: Props) {
  return (
    <View pointerEvents="none" style={[styles.container, style]}>
      <View style={[styles.orb, styles.orbPurple]} />
      <View style={[styles.orb, styles.orbGold]} />
      <View style={[styles.orb, styles.orbDeep]} />
      {/* faint stars */}
      {STAR_POSITIONS.map((s, i) => (
        <View
          key={i}
          style={[
            styles.star,
            {
              top: s.top,
              left: s.left,
              opacity: s.opacity,
              width: s.size,
              height: s.size,
            },
          ]}
        />
      ))}
    </View>
  );
}

const STAR_POSITIONS = [
  { top: "8%", left: "12%", opacity: 0.6, size: 2 },
  { top: "15%", left: "82%", opacity: 0.4, size: 1.5 },
  { top: "22%", left: "45%", opacity: 0.7, size: 2 },
  { top: "33%", left: "20%", opacity: 0.3, size: 1 },
  { top: "42%", left: "75%", opacity: 0.5, size: 2 },
  { top: "55%", left: "10%", opacity: 0.6, size: 1.5 },
  { top: "63%", left: "55%", opacity: 0.4, size: 1 },
  { top: "72%", left: "85%", opacity: 0.7, size: 2 },
  { top: "82%", left: "25%", opacity: 0.5, size: 1.5 },
  { top: "90%", left: "65%", opacity: 0.4, size: 1 },
  { top: "5%", left: "55%", opacity: 0.5, size: 1 },
  { top: "48%", left: "35%", opacity: 0.4, size: 1 },
];

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.bg,
    overflow: "hidden",
  },
  orb: {
    position: "absolute",
    borderRadius: 9999,
  },
  orbPurple: {
    width: 380,
    height: 380,
    backgroundColor: "rgba(157,78,221,0.25)",
    top: -120,
    left: -100,
    // simulate blur on native via shadow
    shadowColor: theme.colors.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 80,
    opacity: 0.8,
  },
  orbGold: {
    width: 280,
    height: 280,
    backgroundColor: "rgba(212,175,55,0.18)",
    bottom: 80,
    right: -90,
    shadowColor: theme.colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 70,
    opacity: 0.6,
  },
  orbDeep: {
    width: 320,
    height: 320,
    backgroundColor: "rgba(58,12,163,0.35)",
    top: "45%",
    left: "30%",
    shadowColor: theme.colors.purpleDeep,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 90,
    opacity: 0.4,
  },
  star: {
    position: "absolute",
    backgroundColor: "#fff",
    borderRadius: 9999,
  },
});
