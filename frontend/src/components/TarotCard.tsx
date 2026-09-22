import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
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
  /** Rider–Waite reversal: rotate front art 180° once the card is face-up. */
  reversed?: boolean;
  onFlip?: () => void;
  /** Tap when not flipping — e.g. open a larger preview. */
  onPress?: () => void;
  testID?: string;
  showShortOnly?: boolean;
  /** Hide symbol/name overlay on front — art-only (e.g. multi-card spreads). */
  hideFrontText?: boolean;
};

const CARD_BACK_IMAGE = require("../../assets/tarot/card-back2.png");
const OUTER_GOLD = "rgba(255,217,154,0.78)";
const INNER_GOLD = "rgba(255,247,234,0.48)";
const RIM_GAP = 5;
const OUTER_BORDER = 1.5;
const INNER_BORDER = 1;

export default function TarotCard({
  card,
  width = 220,
  height = 340,
  flipped,
  reversed = false,
  onFlip,
  onPress,
  testID,
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
    const atRest = progress.value < 0.001 || progress.value > 0.999;
    return {
      opacity,
      transform: atRest
        ? []
        : [{ perspective: 1000 }, { rotateY: `${rotate}deg` }],
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const rotate = interpolate(progress.value, [0, 1], [0, 180]);
    const opacity = progress.value < 0.5 ? 1 : 0;
    const atRest = progress.value < 0.001 || progress.value > 0.999;
    return {
      opacity,
      transform: atRest
        ? []
        : [{ perspective: 1000 }, { rotateY: `${rotate}deg` }],
    };
  });

  const handlePress = () => {
    if (onFlip) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      onFlip();
      return;
    }
    if (!onPress) return;
    Haptics.selectionAsync().catch(() => {});
    onPress();
  };

  const frontIllustration = frontArtSourceForCardId(card.id);
  const compact = width < 160;
  const radius = compact ? 16 : 28;
  const innerRadius = Math.max(8, radius - RIM_GAP - 2);
  const innerW = width - (OUTER_BORDER + RIM_GAP + INNER_BORDER) * 2;
  const innerH = height - (OUTER_BORDER + RIM_GAP + INNER_BORDER) * 2;

  const wrapShadow = compact
    ? {
        shadowColor: "#05030D",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
      }
    : theme.shadows.card;

  const artStyle = { width: innerW, height: innerH, borderRadius: innerRadius };

  return (
    <View style={[styles.wrapper, wrapShadow, { width, height, borderRadius: radius }]}>
      <Pressable
        onPress={handlePress}
        disabled={!onFlip && !onPress}
        testID={testID}
        style={{ width, height, borderRadius: radius }}
      >
        <Animated.View
          style={[styles.face, { width, height }, backStyle]}
          pointerEvents={flipped ? "none" : "auto"}
        >
          <View style={[styles.outerFrame, { width, height, borderRadius: radius }]}>
            <View style={[styles.innerFrame, { width: innerW, height: innerH, borderRadius: innerRadius }]}>
              <Image
                source={CARD_BACK_IMAGE}
                style={artStyle}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
              />
            </View>
          </View>
        </Animated.View>

        <Animated.View
          style={[styles.face, { width, height }, frontStyle]}
          pointerEvents={flipped ? "auto" : "none"}
        >
          <View style={[styles.outerFrame, { width, height, borderRadius: radius }]}>
            <View style={[styles.innerFrame, { width: innerW, height: innerH, borderRadius: innerRadius }]}>
              <View
                style={[
                  artStyle,
                  reversed && styles.reversedArt,
                ]}
              >
                <LinearGradient
                  colors={["#302852", "#171429"]}
                  style={artStyle}
                  pointerEvents="none"
                />
                <Image
                  source={frontIllustration}
                  style={[artStyle, styles.artFill]}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={0}
                />
                <LinearGradient
                  colors={[
                    "rgba(10,11,14,0.45)",
                    "rgba(10,11,14,0)",
                    "rgba(10,11,14,0)",
                    "rgba(10,11,14,0.68)",
                  ]}
                  locations={[0, 0.28, 0.62, 1]}
                  style={[artStyle, styles.artFill]}
                  pointerEvents="none"
                />
              </View>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  face: {
    position: "absolute",
    backfaceVisibility: "hidden",
  },
  outerFrame: {
    borderWidth: OUTER_BORDER,
    borderColor: OUTER_GOLD,
    padding: RIM_GAP,
    backgroundColor: "#171429",
  },
  innerFrame: {
    borderWidth: INNER_BORDER,
    borderColor: INNER_GOLD,
    overflow: "hidden",
  },
  artFill: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  reversedArt: {
    overflow: "hidden",
    transform: [{ rotate: "180deg" }],
  },
});
