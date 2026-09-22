import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

type Props = {
  remaining: number;
  /** Slightly tighter for nested CTAs */
  compact?: boolean;
};

/** Soft count chip for free AI quota, meant to sit on a gradient CTA. */
export default function RemainPill({ remaining, compact = false }: Props) {
  const empty = remaining <= 0;
  return (
    <View
      style={[
        styles.pill,
        compact && styles.pillCompact,
        empty && styles.pillEmpty,
      ]}
    >
      <Text style={[styles.text, empty && styles.textEmpty]}>
        {remaining} ост.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: "rgba(255,247,234,0.16)",
  },
  pillCompact: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillEmpty: {
    backgroundColor: "rgba(255,247,234,0.10)",
  },
  text: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 0.2,
  },
  textEmpty: {
    color: "rgba(255,247,234,0.62)",
  },
});
