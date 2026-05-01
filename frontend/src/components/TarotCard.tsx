import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { theme } from "../theme";
import { TarotCard as TarotCardType } from "../data/tarotCards";
import { frontArtSourceForCardId } from "../data/tarotFrontArt";

type Props = {
  card: TarotCardType;
  width?: number;
  height?: number;
  flipped: boolean;
  onFlip?: () => void;
  testID?: string;
  showShortOnly?: boolean;
  /** Hide symbol/name overlay on front — art-only (e.g. multi-card spreads). */
  hideFrontText?: boolean;
};

const HAIRLINE = StyleSheet.hairlineWidth > 0 ? StyleSheet.hairlineWidth : 1;
const CARD_BACK_IMAGE = require("../../assets/tarot/card-back.png");

export default function TarotCard({
  card,
  width = 220,
  height = 340,
  flipped,
  onFlip,
  testID,
  showShortOnly = false,
  hideFrontText = false,
}: Props) {
  const progress = useSharedValue(flipped ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(flipped ? 1 : 0, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [flipped, progress]);

  const frontStyle = useAnimatedStyle(() => {
    const rotate = interpolate(progress.value, [0, 1], [180, 360]);
    const opacity = progress.value > 0.5 ? 1 : 0;
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotate}deg` }],
      opacity,
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const rotate = interpolate(progress.value, [0, 1], [0, 180]);
    const opacity = progress.value < 0.5 ? 1 : 0;
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotate}deg` }],
      opacity,
    };
  });

  const handlePress = () => {
    if (!onFlip) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onFlip();
  };

  const frontIllustration = frontArtSourceForCardId(card.id);

  return (
    <Pressable
      onPress={handlePress}
      disabled={!onFlip}
      testID={testID}
      style={[styles.wrapper, { width, height }]}
    >
      {/* Back */}
      <Animated.View
        style={[styles.face, { width, height }, backStyle]}
        pointerEvents={flipped ? "none" : "auto"}
      >
        <Image
          source={CARD_BACK_IMAGE}
          style={styles.backImage}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.edgeRim} pointerEvents="none" />
        <View style={styles.innerRim} pointerEvents="none" />
      </Animated.View>

      {/* Front */}
      <Animated.View
        style={[styles.face, styles.frontFace, { width, height }, frontStyle]}
        pointerEvents={flipped ? "auto" : "none"}
      >
        <View style={[styles.frontSurface, { width, height }]}>
          <LinearGradient
            colors={["#302852", "#171429"]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Image
            source={frontIllustration}
            style={styles.frontImage}
            contentFit="cover"
            transition={200}
          />
          <LinearGradient
            colors={[
              "rgba(10,11,14,0.45)",
              "rgba(10,11,14,0)",
              "rgba(10,11,14,0)",
              "rgba(10,11,14,0.68)",
            ]}
            locations={[0, 0.28, 0.62, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.edgeRim} pointerEvents="none" />
          <View style={styles.innerRim} pointerEvents="none" />
          {!hideFrontText && (
            <View style={styles.frontOverlay} pointerEvents="none">
              <Text style={styles.frontSymbol}>{card.symbol}</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.frontName} numberOfLines={2}>
                {card.nameRu}
              </Text>
              {showShortOnly && (
                <Text style={styles.frontShort} numberOfLines={3}>
                  {card.short}
                </Text>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  face: {
    position: "absolute",
    backfaceVisibility: "hidden",
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceMuted,
  },
  frontFace: {},
  edgeRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
  },
  innerRim: {
    ...StyleSheet.absoluteFillObject,
    margin: 7,
    borderRadius: 21,
    borderWidth: HAIRLINE,
    borderColor: "rgba(255,247,234,0.22)",
  },
  backImage: {
    ...StyleSheet.absoluteFillObject,
  },
  frontSurface: {
    overflow: "hidden",
    borderRadius: 26,
    position: "relative",
    backgroundColor: theme.colors.surfaceMuted,
  },
  frontImage: {
    ...StyleSheet.absoluteFillObject,
  },
  frontOverlay: {
    ...StyleSheet.absoluteFillObject,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  frontSymbol: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.headingBold,
    fontSize: 18,
    letterSpacing: 1.5,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  frontName: {
    color: theme.colors.text,
    fontFamily: theme.fonts.headingBold,
    fontSize: 22,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  frontShort: {
    color: theme.colors.text,
    opacity: 0.9,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
