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
import { Sparkles } from "lucide-react-native";
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
};

export default function TarotCard({
  card,
  width = 220,
  height = 340,
  flipped,
  onFlip,
  testID,
  showShortOnly = false,
}: Props) {
  const progress = useSharedValue(0);

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
        <LinearGradient
          colors={[theme.colors.purpleDeep, "#0D0E15", theme.colors.purple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.cardBg, { width, height }]}
        >
          <View style={styles.backBorder}>
            <View style={styles.backInner}>
              <Sparkles color={theme.colors.gold} size={36} />
              <View style={styles.backDivider} />
              <Text style={styles.backSymbol}>✦ ☾ ✦</Text>
              <View style={styles.backDivider} />
              <Text style={styles.backHint}>Нажми, чтобы открыть</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Front */}
      <Animated.View
        style={[styles.face, styles.front, { width, height }, frontStyle]}
        pointerEvents={flipped ? "auto" : "none"}
      >
        <LinearGradient
          colors={card.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.cardBg, { width, height }]}
        >
          <View style={styles.frontBorder}>
            {/* Full-bleed illustration background */}
            <Image
              source={frontIllustration}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
            />
            {/* Gradient overlay for readability of text on top/bottom */}
            <LinearGradient
              colors={[
                "rgba(13,14,21,0.55)",
                "rgba(13,14,21,0.0)",
                "rgba(13,14,21,0.0)",
                "rgba(13,14,21,0.75)",
              ]}
              locations={[0, 0.25, 0.6, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {/* Text overlays */}
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
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
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
    borderRadius: 20,
    overflow: "hidden",
  },
  front: {},
  cardBg: {
    flex: 1,
    padding: 8,
  },
  backBorder: {
    flex: 1,
    borderWidth: 2,
    borderColor: theme.colors.gold,
    borderRadius: 14,
    padding: 10,
    backgroundColor: "rgba(13,14,21,0.4)",
  },
  backInner: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.4)",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  backDivider: {
    width: "60%",
    height: 1,
    backgroundColor: "rgba(212,175,55,0.4)",
  },
  backSymbol: {
    color: theme.colors.gold,
    fontSize: 22,
    letterSpacing: 4,
    fontFamily: theme.fonts.heading,
  },
  backHint: {
    color: theme.colors.textDim,
    fontSize: 12,
    fontFamily: theme.fonts.body,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  frontBorder: {
    flex: 1,
    borderWidth: 2,
    borderColor: theme.colors.gold,
    borderRadius: 14,
    backgroundColor: "rgba(13,14,21,0.35)",
    overflow: "hidden",
    position: "relative",
  },
  frontOverlay: {
    ...StyleSheet.absoluteFillObject,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  frontSymbol: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.headingBold,
    fontSize: 22,
    letterSpacing: 2,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  frontName: {
    color: theme.colors.text,
    fontFamily: theme.fonts.headingBold,
    fontSize: 24,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  frontShort: {
    color: theme.colors.text,
    opacity: 0.9,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
