import React, { forwardRef } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../theme";
import { TarotCard as TarotCardType } from "../data/tarotCards";
import { frontArtSourceForCardId } from "../data/tarotFrontArt";

/** Story-sized still we capture and send to Telegram / Instagram / etc. */
export const SHARE_POSTER_W = 360;
export const SHARE_POSTER_H = 640;

const CARD_W = 292;
const CARD_H = 438;
const CARD_RADIUS = 28;
const RIM = 5;
const OUTER_BORDER = 1.5;
const INNER_BORDER = 1;
const INNER_W = CARD_W - (OUTER_BORDER + RIM + INNER_BORDER) * 2;
const INNER_H = CARD_H - (OUTER_BORDER + RIM + INNER_BORDER) * 2;
const INNER_RADIUS = CARD_RADIUS - RIM - 2;

type Props = {
  card: TarotCardType;
  quote: string;
  reversed?: boolean;
  eyebrow?: string;
  onImageReady?: () => void;
};

const ShareCardPoster = forwardRef<View, Props>(function ShareCardPoster(
  { card, quote, reversed = false, eyebrow = "КАРТА ДНЯ", onImageReady },
  ref,
) {
  const art = frontArtSourceForCardId(card.id);

  return (
    <View
      ref={ref}
      collapsable={false}
      style={styles.poster}
    >
      <LinearGradient
        colors={["#2A1848", "#4A2A78", "#6B3A9A", "#2A1848"]}
        locations={[0, 0.38, 0.62, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.sky}
      />

      <View style={styles.cardOuter}>
        <View style={styles.cardInner}>
          <Image
            source={art}
            style={[styles.art, reversed && styles.artReversed]}
            resizeMode="cover"
            onLoad={onImageReady}
            onError={onImageReady}
          />
          <LinearGradient
            colors={[
              "rgba(12,8,24,0.08)",
              "rgba(12,8,24,0)",
              "rgba(12,8,24,0.22)",
              "rgba(12,8,24,0.82)",
            ]}
            locations={[0, 0.42, 0.68, 1]}
            style={styles.artFade}
            pointerEvents="none"
          />
          <View style={styles.copy} pointerEvents="none">
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.name} numberOfLines={2}>
              {reversed ? `${card.nameRu} · перевёрнутая` : card.nameRu}
            </Text>
            <Text style={styles.quote} numberOfLines={3}>
              «{quote}»
            </Text>
            <Text style={styles.brand}>Arcanyx</Text>
          </View>
        </View>
      </View>
    </View>
  );
});

ShareCardPoster.displayName = "ShareCardPoster";

export default ShareCardPoster;

const styles = StyleSheet.create({
  poster: {
    width: SHARE_POSTER_W,
    height: SHARE_POSTER_H,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2A1848",
  },
  sky: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  cardOuter: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: CARD_RADIUS,
    borderWidth: OUTER_BORDER,
    borderColor: "rgba(255,217,154,0.78)",
    padding: RIM,
    backgroundColor: "#171429",
  },
  cardInner: {
    width: INNER_W,
    height: INNER_H,
    borderRadius: INNER_RADIUS,
    borderWidth: INNER_BORDER,
    borderColor: "rgba(255,247,234,0.48)",
    overflow: "hidden",
    backgroundColor: "#171429",
  },
  art: {
    width: INNER_W,
    height: INNER_H,
  },
  artReversed: {
    transform: [{ rotate: "180deg" }],
  },
  artFade: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  copy: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 18,
    paddingBottom: 16,
    alignItems: "center",
  },
  eyebrow: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 9,
    letterSpacing: 2.4,
    marginBottom: 6,
  },
  name: {
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    fontSize: 22,
    lineHeight: 26,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  quote: {
    color: "rgba(255,247,234,0.92)",
    fontFamily: theme.fonts.headingItalic,
    fontSize: 14,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },
  brand: {
    color: "rgba(255,247,234,0.92)",
    fontFamily: theme.fonts.display,
    fontSize: 15,
    letterSpacing: 0.6,
    marginTop: 14,
  },
});
