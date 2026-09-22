import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { theme } from "../theme";

type Size = "lg" | "md" | "sm";

type Props = {
  /** Small caps line above the headline — rare on tab screens. */
  eyebrow?: string;
  /** Bold first line — omit when `title` is set. */
  lead?: string;
  /** Second headline line in display. */
  accent?: string;
  /** Single-line headline in Yeseva. Use instead of lead/accent. */
  title?: string;
  /** Standfirst under the headline. */
  deck?: string;
  align?: "left" | "center";
  size?: Size;
  /** Gold ✦ divider above the title. */
  showRule?: boolean;
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
};

const SIZE: Record<
  Size,
  { title: number; lineHeight: number; deck: number; deckLine: number }
> = {
  lg: { title: 34, lineHeight: 40, deck: 12, deckLine: 20 },
  md: { title: 30, lineHeight: 36, deck: 12, deckLine: 20 },
  sm: { title: 24, lineHeight: 28, deck: 12, deckLine: 18 },
};

/**
 * Centered tab-screen hero: gold ✦ divider, Yeseva title, lilac Manrope deck.
 * Shared across Сонник, Медитации, Таро, Оракул and the other mystical surfaces.
 */
export default function ScreenHeading({
  eyebrow,
  lead,
  accent,
  title,
  deck,
  align = "center",
  size = "lg",
  showRule = true,
  animated = true,
  style,
  titleStyle,
}: Props) {
  const metrics = SIZE[size];
  const centered = align === "center";
  const headline =
    title ??
    [lead, accent].filter(Boolean).join(" ").trim();

  const wrap = (child: React.ReactNode, delay = 0) =>
    animated ? (
      <Animated.View entering={FadeInDown.duration(420).delay(delay)}>
        {child}
      </Animated.View>
    ) : (
      child
    );

  return (
    <View style={[styles.root, centered && styles.rootCenter, style]}>
      {showRule
        ? wrap(
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerStar}>✦</Text>
              <View style={styles.dividerLine} />
            </View>,
            0,
          )
        : null}

      {eyebrow
        ? wrap(
            <Text style={[styles.eyebrow, centered && styles.textCenter]}>
              {eyebrow}
            </Text>,
            40,
          )
        : null}

      {headline
        ? wrap(
            <Text
              style={[
                styles.title,
                {
                  fontSize: metrics.title,
                  lineHeight: metrics.lineHeight,
                },
                centered && styles.textCenter,
                titleStyle,
              ]}
            >
              {headline}
            </Text>,
            80,
          )
        : null}

      {deck
        ? wrap(
            <Text
              style={[
                styles.deck,
                {
                  fontSize: metrics.deck,
                  lineHeight: metrics.deckLine,
                },
                centered && styles.textCenter,
              ]}
            >
              {deck}
            </Text>,
            140,
          )
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 8,
  },
  rootCenter: {
    alignItems: "center",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    opacity: 0.68,
  },
  dividerLine: {
    width: 54,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.borderGold,
  },
  dividerStar: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.heading,
    fontSize: 14,
  },
  eyebrow: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 3,
    marginBottom: 8,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    letterSpacing: 0.2,
  },
  deck: {
    color: theme.colors.lilac,
    fontFamily: theme.fonts.body,
    marginTop: 6,
    marginBottom: 14,
    maxWidth: 300,
  },
  textCenter: {
    textAlign: "center",
  },
});
