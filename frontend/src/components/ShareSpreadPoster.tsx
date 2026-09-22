import React, { forwardRef, useRef } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../theme";
import { TarotCard as TarotCardType } from "../data/tarotCards";
import { cardShort } from "../data/tarotOrientation";
import { frontArtSourceForCardId } from "../data/tarotFrontArt";
import ShareCardPoster, { SHARE_POSTER_H, SHARE_POSTER_W } from "./ShareCardPoster";

const GOLD_OUTER = "rgba(255,217,154,0.78)";
const GOLD_INNER = "rgba(255,247,234,0.48)";

export type ShareSpreadSlot = {
  card: TarotCardType;
  positionLabelRu: string;
  reversed?: boolean;
};

type Props = {
  spreadTitleRu: string;
  slots: ShareSpreadSlot[];
  /** One-line caption under the cards (quote or short meaning). */
  caption?: string;
  onImageReady?: () => void;
};

const ShareSpreadPoster = forwardRef<View, Props>(function ShareSpreadPoster(
  { spreadTitleRu, slots, caption, onImageReady },
  ref,
) {
  const loadedRef = useRef(0);
  const markReady = () => {
    loadedRef.current += 1;
    if (loadedRef.current >= Math.max(1, slots.length)) {
      onImageReady?.();
    }
  };

  const single = slots.length === 1;
  const title = spreadTitleRu.trim().toUpperCase();

  if (single) {
    return (
      <ShareCardPoster
        ref={ref}
        card={slots[0].card}
        reversed={slots[0].reversed}
        quote={
          caption ??
          cardShort(slots[0].card, slots[0].reversed)
        }
        eyebrow={title}
        onImageReady={onImageReady}
      />
    );
  }

  return (
    <View ref={ref} collapsable={false} style={styles.poster}>
      <LinearGradient
        colors={["#2A1848", "#4A2A78", "#6B3A9A", "#2A1848"]}
        locations={[0, 0.38, 0.62, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.sky}
      />
      <MultiCards
        slots={slots}
        title={title}
        caption={caption}
        onReady={markReady}
      />
    </View>
  );
});

ShareSpreadPoster.displayName = "ShareSpreadPoster";

export default ShareSpreadPoster;

function GoldCard({
  card,
  reversed,
  width,
  height,
  radius,
  onReady,
}: {
  card: TarotCardType;
  reversed?: boolean;
  width: number;
  height: number;
  radius: number;
  onReady?: () => void;
}) {
  const rim = 4;
  const outer = 1.4;
  const inner = 1;
  const innerW = width - (outer + rim + inner) * 2;
  const innerH = height - (outer + rim + inner) * 2;
  const innerRadius = Math.max(6, radius - rim - 2);
  const art = frontArtSourceForCardId(card.id);

  return (
    <View
      style={[
        styles.cardOuter,
        {
          width,
          height,
          borderRadius: radius,
          borderWidth: outer,
          padding: rim,
        },
      ]}
    >
      <View
        style={{
          width: innerW,
          height: innerH,
          borderRadius: innerRadius,
          borderWidth: inner,
          borderColor: GOLD_INNER,
          overflow: "hidden",
          backgroundColor: "#171429",
        }}
      >
        <Image
          source={art}
          style={{
            width: innerW,
            height: innerH,
            transform: reversed ? [{ rotate: "180deg" }] : undefined,
          }}
          resizeMode="cover"
          onLoad={onReady}
          onError={onReady}
        />
      </View>
    </View>
  );
}

function MultiCards({
  slots,
  title,
  caption,
  onReady,
}: {
  slots: ShareSpreadSlot[];
  title: string;
  caption?: string;
  onReady?: () => void;
}) {
  const dense = slots.length >= 4;
  const cardW = dense ? 76 : slots.length > 2 ? 96 : 124;
  const cardH = Math.round(cardW * 1.54);

  return (
    <View style={styles.multiWrap}>
      <Text style={styles.eyebrow}>{title}</Text>
      <View style={[styles.row, dense && styles.rowDense]}>
        {slots.map((slot) => (
          <View
            key={`${slot.positionLabelRu}-${slot.card.id}`}
            style={[styles.col, dense && styles.colDense]}
          >
            <Text style={styles.position} numberOfLines={1}>
              {slot.positionLabelRu}
            </Text>
            <GoldCard
              card={slot.card}
              reversed={slot.reversed}
              width={cardW}
              height={cardH}
              radius={14}
              onReady={onReady}
            />
            <Text style={styles.cardName} numberOfLines={2}>
              {slot.card.nameRu}
            </Text>
          </View>
        ))}
      </View>
      {caption ? (
        <Text style={styles.multiCaption} numberOfLines={4}>
          {caption}
        </Text>
      ) : null}
      <Text style={styles.brand}>Arcanyx</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  poster: {
    width: SHARE_POSTER_W,
    height: SHARE_POSTER_H,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2A1848",
    overflow: "hidden",
  },
  sky: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  cardOuter: {
    borderColor: GOLD_OUTER,
    backgroundColor: "#171429",
  },
  multiWrap: {
    width: SHARE_POSTER_W,
    height: SHARE_POSTER_H,
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 36,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  rowDense: {
    width: 296,
    flexWrap: "wrap",
  },
  col: {
    alignItems: "center",
    gap: 8,
    maxWidth: 110,
  },
  colDense: {
    width: 92,
  },
  position: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    textAlign: "center",
  },
  cardName: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
  },
  eyebrow: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 9,
    letterSpacing: 2.4,
    textAlign: "center",
  },
  multiCaption: {
    color: "rgba(255,247,234,0.88)",
    fontFamily: theme.fonts.headingItalic,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  brand: {
    color: "rgba(255,247,234,0.92)",
    fontFamily: theme.fonts.display,
    fontSize: 15,
    letterSpacing: 0.6,
    marginTop: 8,
  },
});
