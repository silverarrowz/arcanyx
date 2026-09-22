import React from "react";
import {
  ImageSourcePropType,
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { theme } from "../theme";

export type MastheadStat = {
  value: number | string;
  label: string;
};

type Props = {
  /** Small caps line above the headline, e.g. «ЛИЧНЫЙ АРХИВ · СЕНТЯБРЬ». */
  eyebrow: string;
  /** First headline line, set in the UI sans. */
  lead: string;
  /** Second headline line, set in the italic serif and tinted lavender. */
  accent: string;
  /** Standfirst paragraph under the headline. */
  deck?: string;
  /** Optional illustration beside the deck — e.g. the diary book on Профиль. */
  deckIllustration?: ImageSourcePropType;
  stats?: MastheadStat[];
  style?: StyleProp<ViewStyle>;
};

/**
 * Editorial masthead in the Arcanyx visual-archive style: a hairline rule, a
 * letterspaced eyebrow, and a two-line headline that hands off from the UI sans
 * to an italic serif. Meant for index/archive surfaces — it deliberately reads
 * colder and quieter than the app's card UI.
 */
export default function EditorialMasthead({
  eyebrow,
  lead,
  accent,
  deck,
  deckIllustration,
  stats,
  style,
}: Props) {
  const { width } = useWindowDimensions();
  // The headline is the whole design; let it grow on wide screens.
  const headlineSize = Math.max(26, Math.min(width * 0.082, 36));

  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={[
          "rgba(12,11,17,0)",
          "rgba(12,11,17,0.74)",
          "rgba(12,11,17,0.88)",
          "rgba(12,11,17,0)",
        ]}
        locations={[0, 0.18, 0.74, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <Animated.View entering={FadeInDown.duration(420)} style={styles.rule} />

      <Animated.Text
        entering={FadeInDown.duration(420).delay(60)}
        style={styles.eyebrow}
      >
        {eyebrow}
      </Animated.Text>

      <Animated.View entering={FadeInDown.duration(460).delay(120)}>
        <Text
          style={[
            styles.lead,
            { fontSize: headlineSize, lineHeight: headlineSize * 1.12 },
          ]}
        >
          {lead}
        </Text>
        <Text
          style={[
            styles.accent,
            { fontSize: headlineSize * 1.04, lineHeight: headlineSize * 1.24 },
          ]}
        >
          {accent}
        </Text>
      </Animated.View>

      {deck ? (
        <Animated.View
          entering={FadeInDown.duration(460).delay(180)}
          style={[styles.deckRow, deckIllustration ? styles.deckRowWithArt : null]}
        >
          {deckIllustration ? (
            <Image
              source={deckIllustration}
              style={styles.deckIllustration}
              contentFit="contain"
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          ) : null}
          <Text style={[styles.deck, deckIllustration ? styles.deckBesideArt : null]}>
            {deck}
          </Text>
        </Animated.View>
      ) : null}

      {stats?.length ? (
        <Animated.View
          entering={FadeInDown.duration(460).delay(240)}
          style={styles.stats}
        >
          {stats.map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 26,
    overflow: "hidden",
  },
  rule: {
    height: 1,
    backgroundColor: theme.colors.archive.rule,
    marginBottom: 30,
  },
  eyebrow: {
    color: theme.colors.archive.label,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 2.4,
    marginBottom: 14,
  },
  lead: {
    color: theme.colors.archive.headline,
    // No fontFamily: this is the platform UI sans (SF Pro on iOS), as in the mock.
    fontWeight: "700",
    letterSpacing: -0.7,
  },
  accent: {
    color: theme.colors.archive.accent,
    fontFamily: theme.fonts.editorialItalic,
    fontStyle: theme.editorialItalicStyle,
    letterSpacing: -0.2,
  },
  deckRow: {
    marginTop: 18,
  },
  deckRowWithArt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  deckIllustration: {
    width: 56,
    height: 56,
    opacity: 0.92,
    flexShrink: 0,
  },
  deck: {
    color: theme.colors.archive.body,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 440,
    flex: 1,
  },
  deckBesideArt: {
    marginTop: 0,
    maxWidth: undefined,
  },
  stats: {
    flexDirection: "row",
    marginTop: 26,
    gap: 28,
  },
  stat: {
    minWidth: 52,
  },
  statValue: {
    color: theme.colors.archive.headline,
    fontFamily: theme.fonts.editorialSerif,
    fontSize: 28,
    lineHeight: 33,
  },
  statLabel: {
    color: theme.colors.archive.label,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
});
