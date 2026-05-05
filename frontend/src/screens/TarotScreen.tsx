import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type PanResponderGestureState,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  Layers,
  PenTool,
  X,
  Sparkles,
  ArrowLeft,
  ChevronDown,
} from "lucide-react-native";
import { theme } from "../theme";
import CosmicBackground from "../components/CosmicBackground";
import GlassCard from "../components/GlassCard";
import TarotCard from "../components/TarotCard";
import { TAROT_DECK, TarotCard as TarotCardType } from "../data/tarotCards";
import {
  DEFAULT_SPREAD_ID,
  TAROT_SPREADS,
  TarotSpread,
  getSpreadById,
} from "../data/tarotSpreads";
import { buildTarotSummaryRu } from "../data/tarotReadingSummary";
import { TarotCardSnapshot, useHistory } from "../context/HistoryContext";

type FlowPhase = "select" | "picking" | "reveal" | "reading";

/** «выбери 3 карты» — склонение числа для подсказки у колоды */
function chooseCardsPhraseRu(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `выбери ${n} карту`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return `выбери ${n} карты`;
  return `выбери ${n} карт`;
}

function PickCardsDeckHint({ count }: { count: number }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.14, {
        duration: 780,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [pulse]);

  const pointerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 1.14], [0.72, 1]),
  }));

  const phrase = useMemo(() => chooseCardsPhraseRu(count), [count]);

  return (
    <View style={styles.pickDeckHint} pointerEvents="none">
      <Text style={styles.pickDeckHintText}>{phrase}</Text>
      <Animated.View style={[styles.pickDeckPointerWrap, pointerStyle]}>
        <ChevronDown
          color={theme.colors.gold}
          size={30}
          strokeWidth={2.5}
        />
      </Animated.View>
    </View>
  );
}

/** Larger cards + layout tweaks for 3-card spreads */
const MULTI_CARD_WIDTH = 118;
const MULTI_CARD_HEIGHT = 182;
/** Single-card spread: strip + slot placeholder match this size */
const SINGLE_FAN_CARD_WIDTH = 120;
const SINGLE_FAN_CARD_HEIGHT = 185;

/** How many distinct cards appear in the horizontal deck strip while picking */
const FAN_POOL_SIZE = Math.min(28, TAROT_DECK.length);

/** Horizontal padding inside deck strip content (matches `deckStripContent`). */
const DECK_CONTENT_PAD_X = 24;

function shuffleFan(count: number = FAN_POOL_SIZE): TarotCardType[] {
  const arr = [...TAROT_DECK];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

const SPREAD_BG_IMAGES: Record<string, ImageSourcePropType> = {
  "one-card": require("../../assets/tarot/bg/bgi1.png"),
  "three-time": require("../../assets/tarot/bg/bgi2.png"),
  "three-situation": require("../../assets/tarot/bg/bgi3.png"),
  "love-three": require("../../assets/tarot/bg/sprd-love.png"),
  "thoughts": require("../../assets/tarot/bg/sprd-thoughts2.png"),
  "choice": require("../../assets/tarot/bg/sprd-2ways.png"),
  "career-growth": require("../../assets/tarot/bg/sprd-career2.png"),
  "where-money": require("../../assets/tarot/bg/sprd-riches.png"),
};

function SchemeSilhouette({
  active,
  rotate,
  style,
}: {
  active: boolean;
  rotate?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.schemeMiniCard,
        active && styles.schemeMiniCardActive,
        rotate ? { transform: [{ rotate }] } : null,
        style,
      ]}
    />
  );
}

function SpreadSchemePreview({
  spread,
  active,
}: {
  spread: TarotSpread;
  active: boolean;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const compactScheme = windowWidth < 380;

  const silhouetteStyle = compactScheme
    ? styles.schemeMiniCardCompact
    : styles.schemeMiniCardLarge;
  const panelStyle = [
    styles.schemePanel,
    compactScheme ? styles.schemePanelCompact : styles.schemePanelRoomy,
  ];

  if (spread.id === "one-card") {
    return (
      <View style={panelStyle} pointerEvents="none">
        <View style={styles.schemeSingleWrap}>
          <SchemeSilhouette active={active} style={silhouetteStyle} />
        </View>
      </View>
    );
  }

  return (
    <View style={panelStyle} pointerEvents="none">
      <View style={styles.schemeRowThree}>
        <SchemeSilhouette
          active={active}
          rotate="-4deg"
          style={[styles.schemeRowCardLeft, silhouetteStyle]}
        />
        <SchemeSilhouette
          active={active}
          style={[styles.schemeRowCardMid, silhouetteStyle]}
        />
        <SchemeSilhouette
          active={active}
          rotate="4deg"
          style={[styles.schemeRowCardRight, silhouetteStyle]}
        />
      </View>
    </View>
  );
}

type TarotScreenProps = {
  /** When true, top safe area is handled by the parent (e.g. Gadania segment header). */
  embedded?: boolean;
};

type Rect = { x: number; y: number; width: number; height: number };

type PickFlight = {
  card: TarotCardType;
  width: number;
  height: number;
  hideFrontText: boolean;
};

export default function TarotScreen({ embedded = false }: TarotScreenProps) {
  const { width } = useWindowDimensions();
  const { addItem } = useHistory();
  const revealTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [spreadId, setSpreadId] = useState<TarotSpread["id"]>(DEFAULT_SPREAD_ID);
  const spread = useMemo(() => getSpreadById(spreadId), [spreadId]);

  const [flowPhase, setFlowPhase] = useState<FlowPhase>("select");
  const [readingSummaryRu, setReadingSummaryRu] = useState<string | null>(
    null,
  );

  const [fan, setFan] = useState<TarotCardType[]>(() => shuffleFan());
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [slots, setSlots] = useState<(TarotCardType | null)[]>(() =>
    Array(spread.drawCount).fill(null),
  );
  const [revealedSlots, setRevealedSlots] = useState<boolean[]>(() =>
    Array(spread.drawCount).fill(false),
  );

  const [intuitionOpen, setIntuitionOpen] = useState(false);
  const [intuitionText, setIntuitionText] = useState("");
  const [savedIntuition, setSavedIntuition] = useState<string>("");

  /** Deck strip: scroll-linked fan so the arc is always centered on the viewport. */
  const [deckScrollX, setDeckScrollX] = useState(0);
  const [deckViewportW, setDeckViewportW] = useState(width);
  const [deckContentWidth, setDeckContentWidth] = useState(0);
  const rootRef = useRef<View>(null);
  const mainScrollRef = useRef<ScrollView>(null);
  const deckStripRef = useRef<ScrollView>(null);
  const deckCardRefs = useRef<Record<string, View | null>>({});
  const slotRefs = useRef<Record<number, View | null>>({});
  /** One-shot center scroll each time user enters picking (not after each pick). */
  const deckNeedsInitialCenterRef = useRef(false);
  const isPickAnimatingRef = useRef(false);
  const pickFlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const dragSourceRectRef = useRef<Rect | null>(null);
  const draggingCardRef = useRef<TarotCardType | null>(null);
  const [pickFlight, setPickFlight] = useState<PickFlight | null>(null);
  const flightX = useSharedValue(0);
  const flightY = useSharedValue(0);
  const flightScale = useSharedValue(1);
  const flightOpacity = useSharedValue(0);

  const drawCount = spread.drawCount;
  const nextSlotIndex = slots.findIndex((s) => s === null);
  const allPicked = nextSlotIndex === -1;

  const clearRevealTimers = useCallback(() => {
    revealTimeoutsRef.current.forEach((timerId) => clearTimeout(timerId));
    revealTimeoutsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearRevealTimers();
    };
  }, [clearRevealTimers]);

  const resetSession = useCallback(
    (keepSpread?: TarotSpread) => {
      clearRevealTimers();
      const s = keepSpread ?? getSpreadById(DEFAULT_SPREAD_ID);
      setSpreadId(s.id);
      setFan(shuffleFan());
      setPickedIds([]);
      setSlots(Array(s.drawCount).fill(null));
      setRevealedSlots(Array(s.drawCount).fill(false));
      setFlowPhase("select");
      setIntuitionOpen(false);
      setIntuitionText("");
      setSavedIntuition("");
      setReadingSummaryRu(null);
    },
    [clearRevealTimers],
  );

  /** Tap a spread card → select spread, shuffle fan, go straight to picking. */
  const handleSelectSpreadAndStart = (id: TarotSpread["id"]) => {
    if (flowPhase !== "select") return;
    clearRevealTimers();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const next = getSpreadById(id);
    setSpreadId(id);
    setSlots(Array(next.drawCount).fill(null));
    setPickedIds([]);
    setRevealedSlots(Array(next.drawCount).fill(false));
    setReadingSummaryRu(null);
    setFan(shuffleFan());
    setFlowPhase("picking");
  };

  /** Возврат к списку раскладов (как «Новый расклад»). */
  const goBackToSelect = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    resetSession(spread);
  }, [resetSession, spread]);

  const commitHistory = useCallback(
    (filledSlots: TarotCardType[], summaryRu: string) => {
      const snapshot: TarotCardSnapshot[] = filledSlots.map((c, i) => ({
        positionId: spread.positions[i].id,
        positionLabelRu: spread.positions[i].labelRu,
        cardId: c.id,
        cardName: c.nameRu,
      }));

      let question: string;
      let answer: string;

      if (drawCount === 1) {
        const c = filledSlots[0];
        question = spread.titleRu;
        answer = `${c.nameRu} — ${c.short}`;
      } else {
        question = spread.titleRu;
        answer = filledSlots
          .map((c, i) => `${spread.positions[i].labelRu}: ${c.nameRu}`)
          .join(" · ");
      }

      addItem({
        type: "tarot",
        question,
        answer,
        cardId: drawCount === 1 ? filledSlots[0].id : undefined,
        cardName: drawCount === 1 ? filledSlots[0].nameRu : undefined,
        spread: spread.id,
        spreadLabelRu: spread.titleRu,
        cardsSnapshot: snapshot,
        tarotSummaryRu: summaryRu,
      });
    },
    [addItem, spread, drawCount],
  );

  const startAutoReveal = useCallback(
    (filledSlots: TarotCardType[]) => {
      clearRevealTimers();
      setRevealedSlots(Array(drawCount).fill(false));
      setFlowPhase("reveal");

      const revealStepMs = 320;
      const revealStartDelayMs = 220;

      filledSlots.forEach((_, slotIndex) => {
        const timerId = setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          setRevealedSlots((prev) => {
            const next = [...prev];
            next[slotIndex] = true;
            return next;
          });
        }, revealStartDelayMs + slotIndex * revealStepMs);
        revealTimeoutsRef.current.push(timerId);
      });

      const finishTimerId = setTimeout(() => {
        const summary = buildTarotSummaryRu(spread, filledSlots, "");
        setReadingSummaryRu(summary);
        commitHistory(filledSlots, summary);
        setFlowPhase("reading");
      }, revealStartDelayMs + filledSlots.length * revealStepMs + 520);
      revealTimeoutsRef.current.push(finishTimerId);
    },
    [clearRevealTimers, commitHistory, drawCount, spread],
  );

  const measureRelativeToRoot = useCallback(
    (node: View | null, onMeasured: (rect: Rect | null) => void) => {
      const rootNode = rootRef.current;
      if (!rootNode || !node) {
        onMeasured(null);
        return;
      }

      rootNode.measureInWindow((rootX, rootY) => {
        node.measureInWindow((x, y, measuredWidth, measuredHeight) => {
          if (measuredWidth <= 0 || measuredHeight <= 0) {
            onMeasured(null);
            return;
          }
          onMeasured({
            x: x - rootX,
            y: y - rootY,
            width: measuredWidth,
            height: measuredHeight,
          });
        });
      });
    },
    [],
  );

  const commitPickedCard = useCallback(
    (card: TarotCardType, idx: number) => {
      const nextSlots = [...slots];
      nextSlots[idx] = card;
      const nextPickedIds = [...pickedIds, card.id];

      setSlots(nextSlots);
      setPickedIds(nextPickedIds);

      const filledCount = nextSlots.filter(Boolean).length;
      if (filledCount === drawCount) {
        startAutoReveal(nextSlots as TarotCardType[]);
      }
    },
    [drawCount, pickedIds, slots, startAutoReveal],
  );

  const resetPickFlight = useCallback(() => {
    if (pickFlightTimeoutRef.current) {
      clearTimeout(pickFlightTimeoutRef.current);
      pickFlightTimeoutRef.current = null;
    }
    draggingCardRef.current = null;
    dragSourceRectRef.current = null;
    isPickAnimatingRef.current = false;
    flightOpacity.value = 0;
    setPickFlight(null);
  }, [flightOpacity]);

  const animatePickToSlot = useCallback(
    (
      card: TarotCardType,
      sourceRect: Rect,
      targetRect: Rect,
      slotIndex: number,
    ) => {
      const targetX = targetRect.x + targetRect.width / 2 - sourceRect.width / 2;
      const targetY =
        targetRect.y + targetRect.height / 2 - sourceRect.height / 2;

      setPickFlight({
        card,
        width: sourceRect.width,
        height: sourceRect.height,
        hideFrontText: drawCount > 1,
      });
      flightOpacity.value = 1;
      flightX.value = sourceRect.x;
      flightY.value = sourceRect.y;
      flightScale.value = 1.04;

      requestAnimationFrame(() => {
        flightX.value = withTiming(targetX, {
          duration: 360,
          easing: Easing.out(Easing.cubic),
        });
        flightY.value = withTiming(targetY, {
          duration: 360,
          easing: Easing.out(Easing.cubic),
        });
        flightScale.value = withTiming(1, {
          duration: 360,
          easing: Easing.out(Easing.cubic),
        });
      });

      if (pickFlightTimeoutRef.current) {
        clearTimeout(pickFlightTimeoutRef.current);
      }
      pickFlightTimeoutRef.current = setTimeout(() => {
        pickFlightTimeoutRef.current = null;
        commitPickedCard(card, slotIndex);
        resetPickFlight();
      }, 380);
    },
    [
      commitPickedCard,
      drawCount,
      flightOpacity,
      flightScale,
      flightX,
      flightY,
      resetPickFlight,
    ],
  );

  const handlePickCard = useCallback((card: TarotCardType) => {
    if (flowPhase !== "picking") return;
    if (pickedIds.includes(card.id)) return;
    if (allPicked) return;
    if (isPickAnimatingRef.current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    const idx = slots.findIndex((s) => s === null);
    if (idx === -1) return;

    const sourceNode = deckCardRefs.current[card.id];
    const targetNode = slotRefs.current[idx];
    isPickAnimatingRef.current = true;

    measureRelativeToRoot(sourceNode, (sourceRect) => {
      measureRelativeToRoot(targetNode, (targetRect) => {
        if (!sourceRect || !targetRect) {
          commitPickedCard(card, idx);
          resetPickFlight();
          return;
        }
        animatePickToSlot(card, sourceRect, targetRect, idx);
      });
    });
  }, [
    allPicked,
    animatePickToSlot,
    commitPickedCard,
    flowPhase,
    measureRelativeToRoot,
    pickedIds,
    resetPickFlight,
    slots,
  ]);

  const beginDragCard = useCallback(
    (card: TarotCardType) => {
      if (flowPhase !== "picking") return;
      if (pickedIds.includes(card.id) || allPicked) return;
      if (isPickAnimatingRef.current) return;

      const sourceNode = deckCardRefs.current[card.id];
      isPickAnimatingRef.current = true;

      measureRelativeToRoot(sourceNode, (sourceRect) => {
        if (!sourceRect) {
          resetPickFlight();
          return;
        }
        draggingCardRef.current = card;
        dragSourceRectRef.current = sourceRect;
        setPickFlight({
          card,
          width: sourceRect.width,
          height: sourceRect.height,
          hideFrontText: drawCount > 1,
        });
        flightX.value = sourceRect.x;
        flightY.value = sourceRect.y;
        flightScale.value = 1.06;
        flightOpacity.value = 1;
      });
    },
    [
      allPicked,
      drawCount,
      flightOpacity,
      flightScale,
      flightX,
      flightY,
      flowPhase,
      measureRelativeToRoot,
      pickedIds,
      resetPickFlight,
    ],
  );

  const updateDraggedCard = useCallback(
    (_event: GestureResponderEvent, gesture: PanResponderGestureState) => {
      const sourceRect = dragSourceRectRef.current;
      if (!sourceRect || !draggingCardRef.current) return;
      flightX.value = sourceRect.x + gesture.dx;
      flightY.value = sourceRect.y + gesture.dy;
      flightScale.value = 1.07;
    },
    [flightScale, flightX, flightY],
  );

  const finishDraggedCard = useCallback(
    (_event: GestureResponderEvent, gesture: PanResponderGestureState) => {
      const card = draggingCardRef.current;
      const sourceRect = dragSourceRectRef.current;
      const idx = slots.findIndex((s) => s === null);
      if (!card || !sourceRect || idx === -1) {
        resetPickFlight();
        return;
      }

      const currentRect = {
        ...sourceRect,
        x: sourceRect.x + gesture.dx,
        y: sourceRect.y + gesture.dy,
      };
      const targetNode = slotRefs.current[idx];

      measureRelativeToRoot(targetNode, (targetRect) => {
        if (!targetRect) {
          resetPickFlight();
          return;
        }

        const centerX = currentRect.x + currentRect.width / 2;
        const centerY = currentRect.y + currentRect.height / 2;
        const releasedNearSlot =
          centerX >= targetRect.x - 64 &&
          centerX <= targetRect.x + targetRect.width + 64 &&
          centerY >= targetRect.y - 80 &&
          centerY <= targetRect.y + targetRect.height + 80;
        const pulledFromDeck = gesture.dy < -54;

        if (releasedNearSlot || pulledFromDeck) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          animatePickToSlot(card, currentRect, targetRect, idx);
          return;
        }

        flightX.value = withTiming(sourceRect.x, {
          duration: 220,
          easing: Easing.out(Easing.cubic),
        });
        flightY.value = withTiming(sourceRect.y, {
          duration: 220,
          easing: Easing.out(Easing.cubic),
        });
        flightScale.value = withTiming(1, {
          duration: 220,
          easing: Easing.out(Easing.cubic),
        });
        flightOpacity.value = withTiming(0, { duration: 160 });
        if (pickFlightTimeoutRef.current) {
          clearTimeout(pickFlightTimeoutRef.current);
        }
        pickFlightTimeoutRef.current = setTimeout(() => {
          pickFlightTimeoutRef.current = null;
          resetPickFlight();
        }, 230);
      });
    },
    [
      animatePickToSlot,
      flightOpacity,
      flightScale,
      flightX,
      flightY,
      measureRelativeToRoot,
      resetPickFlight,
      slots,
    ],
  );

  const makeDeckCardPanHandlers = useCallback(
    (card: TarotCardType) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          flowPhase === "picking" &&
          gesture.dy < -4 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx) * 0.7,
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          flowPhase === "picking" &&
          gesture.dy < -4 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx) * 0.7,
        onPanResponderGrant: () => beginDragCard(card),
        onPanResponderMove: updateDraggedCard,
        onPanResponderRelease: finishDraggedCard,
        onPanResponderTerminate: finishDraggedCard,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }).panHandlers,
    [beginDragCard, finishDraggedCard, flowPhase, updateDraggedCard],
  );

  const pickFlightStyle = useAnimatedStyle(() => ({
    opacity: flightOpacity.value,
    transform: [
      { translateX: flightX.value },
      { translateY: flightY.value },
      { scale: flightScale.value },
    ],
  }));

  useEffect(() => {
    if (flowPhase !== "picking" && pickFlight) {
      resetPickFlight();
    }
  }, [flowPhase, pickFlight, resetPickFlight]);

  const resetSpread = () => {
    Haptics.selectionAsync().catch(() => {});
    resetSession(spread);
  };

  const saveIntuition = () => {
    setSavedIntuition(intuitionText.trim());
    setIntuitionOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
  };

  const subtitle = useMemo(() => {
    switch (flowPhase) {
      case "select":
        return "Расклады на любые случаи жизни";
      case "picking":
        return `Выбрано ${pickedIds.length} из ${drawCount} · листай колоду`;
      case "reveal":
        return "";
      case "reading":
        return "";
      default:
        return "";
    }
  }, [flowPhase, pickedIds.length, drawCount]);

  const visibleFan = useMemo(
    () => fan.filter((c) => !pickedIds.includes(c.id)),
    [fan, pickedIds],
  );

  useEffect(() => {
    setDeckViewportW(width);
  }, [width]);

  useEffect(() => {
    if (flowPhase === "picking") {
      deckNeedsInitialCenterRef.current = true;
      setDeckContentWidth(0);
      setDeckScrollX(0);
    }
  }, [flowPhase]);

  useEffect(() => {
    if (flowPhase === "select") return;
    mainScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [flowPhase]);

  const tryApplyDeckInitialCenter = useCallback(() => {
    if (!deckNeedsInitialCenterRef.current || flowPhase !== "picking") return;
    const vw = deckViewportW > 0 ? deckViewportW : width;
    if (deckContentWidth <= 0 || vw <= 0) return;
    const maxScroll = Math.max(0, deckContentWidth - vw);
    const targetX = maxScroll / 2;
    requestAnimationFrame(() => {
      deckStripRef.current?.scrollTo({ x: targetX, animated: false });
      setDeckScrollX(targetX);
      deckNeedsInitialCenterRef.current = false;
    });
  }, [flowPhase, deckContentWidth, deckViewportW, width]);

  useEffect(() => {
    tryApplyDeckInitialCenter();
  }, [tryApplyDeckInitialCenter]);

  const onDeckScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setDeckScrollX(e.nativeEvent.contentOffset.x);
    },
    [],
  );

  const onDeckViewportLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setDeckViewportW(w);
  }, []);

  const onDeckContentSizeChange = useCallback((cw: number, _ch: number) => {
    setDeckContentWidth(cw);
  }, []);

  /** Fan curve is anchored to viewport center, not to the middle of the card list */
  const deckFanLayout = useMemo(() => {
    const fanCardW =
      drawCount > 1 ? MULTI_CARD_WIDTH : SINGLE_FAN_CARD_WIDTH;
    const fanCardH =
      drawCount > 1 ? MULTI_CARD_HEIGHT : SINGLE_FAN_CARD_HEIGHT;
    const fanStep =
      drawCount > 1 ? MULTI_CARD_WIDTH - 28 : SINGLE_FAN_CARD_WIDTH - 44;
    const vw = deckViewportW > 0 ? deckViewportW : width;
    const viewportCenterX = deckScrollX + vw / 2;
    return { fanCardW, fanCardH, fanStep, viewportCenterX };
  }, [drawCount, deckScrollX, deckViewportW, width]);

  const intuitionModalSubtitle =
    drawCount === 1
      ? "Запиши свои первые мысли, прежде чем читать толкование."
      : "Запиши ощущения от всего расклада, прежде чем читать трактовку.";

  const pickingOrRevealOrReading =
    flowPhase === "picking" ||
    flowPhase === "reveal" ||
    flowPhase === "reading";
  const compactSpreadCards = width < 370;

  return (
    <View ref={rootRef} style={styles.root}>
      <CosmicBackground />
      <SafeAreaView
        style={styles.safe}
        edges={embedded ? ["bottom"] : ["top"]}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {flowPhase !== "select" ? (
            <View style={styles.topBackBar} pointerEvents="box-none">
              <Pressable
                onPress={goBackToSelect}
                testID="tarot-top-back"
                accessibilityRole="button"
                accessibilityLabel="К выбору расклада"
                style={({ pressed }) => [
                  styles.topBackRow,
                  pressed && { opacity: 0.82 },
                ]}
              >
                <ArrowLeft color={theme.colors.textDim} size={20} />
                <Text style={styles.topBackLabel}>К раскладам</Text>
              </Pressable>
            </View>
          ) : null}
          <ScrollView
            ref={mainScrollRef}
            style={{ flex: 1 }}
            scrollEnabled={flowPhase !== "picking"}
            bounces={flowPhase !== "picking"}
            nestedScrollEnabled
            contentContainerStyle={[
              styles.scroll,
              flowPhase === "picking" && styles.scrollPickingLocked,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
          <View style={styles.heroCopy}>
            <View style={styles.heroDivider}>
              <View style={styles.heroDividerLine} />
              <Text style={styles.heroDividerStar}>✦</Text>
              <View style={styles.heroDividerLine} />
            </View>
            <Text style={styles.title}>
              {flowPhase === "select" ? "Таро" : spread.titleRu}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>

          {/* ——— Select spread ——— */}
          {flowPhase === "select" && (
            <Animated.View entering={FadeIn.duration(380)}>
              {/* <View style={styles.selectIntro}>
                <Text style={styles.selectIntroTitle}>Выбери форму расклада</Text>
                <Text style={styles.selectIntroText}>
                  Схема на карточке — позиции расклада. Коснись карточки, чтобы
                  сразу перейти к выбору карт.
                </Text>
              </View> */}

              <View style={styles.spreadPickerCol} testID="spread-picker">
                {TAROT_SPREADS.map((s) => {
                  const spreadBg =
                    SPREAD_BG_IMAGES[s.id] ?? SPREAD_BG_IMAGES["one-card"];
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => handleSelectSpreadAndStart(s.id)}
                      testID={`spread-chip-${s.id}`}
                      style={({ pressed }) => [
                        styles.spreadOption,
                        compactSpreadCards && styles.spreadOptionCompact,
                        pressed && { transform: [{ scale: 0.985 }] },
                      ]}
                    >
                      <Image
                        source={spreadBg}
                        style={styles.spreadOptionBgImage}
                        contentFit="cover"
                        transition={220}
                      />
                      <View style={styles.spreadOptionBgScrim} />
                      <LinearGradient
                        colors={[
                          "rgba(8,6,18,0)",
                          "rgba(8,6,18,0.38)",
                          "rgba(8,6,18,0.72)",
                        ]}
                        locations={[0, 0.45, 1]}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={StyleSheet.absoluteFill}
                        pointerEvents="none"
                      />
                      <View style={styles.spreadOptionTop}>
                        <View style={styles.spreadIconPill}>
                          <Sparkles color={theme.colors.gold} size={15} />
                        </View>
                        <Text style={styles.spreadOptionBadge}>
                          {s.drawCount === 1 ? "1 карта" : `${s.drawCount} карты`}
                        </Text>
                      </View>

                      <SpreadSchemePreview spread={s} active={false} />

                      <View style={styles.spreadOptionCopy}>
                        <Text style={styles.spreadOptionTitle} numberOfLines={2}>
                          {s.titleRu}
                        </Text>
                        <Text style={styles.spreadOptionSubtitle} numberOfLines={2}>
                          {s.subtitleRu}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {/* Slot row: picking (placeholder / face-down preview of assigned not shown until reveal) */}
          {pickingOrRevealOrReading && drawCount > 1 && (
            <View style={styles.slotsRow}>
              {spread.positions.map((pos, i) => {
                const slotCard = slots[i];
                const isNextPick =
                  flowPhase === "picking" && i === nextSlotIndex;
                const showCardNameBelow =
                  !!slotCard &&
                  (flowPhase === "reading" ||
                    (flowPhase === "reveal" && revealedSlots[i]));

                return (
                  <View
                    key={pos.id}
                    style={styles.slotCol}
                    testID={`three-card-slot-${i}`}
                  >
                    <Text
                      style={[
                        styles.slotPositionLabel,
                        isNextPick && { color: theme.colors.gold },
                        !slotCard &&
                          flowPhase === "reveal" && { opacity: 0.45 },
                      ]}
                      numberOfLines={2}
                    >
                      {pos.labelRu}
                    </Text>
                    <View
                      ref={(node) => {
                        slotRefs.current[i] = node;
                      }}
                    >
                      <Animated.View
                        entering={FadeInDown.duration(380).springify()}
                        layout={Layout.springify()}
                      >
                        {flowPhase === "picking" && !slotCard && (
                          <View
                            style={[
                              styles.slotPlaceholder,
                              {
                                width: MULTI_CARD_WIDTH,
                                height: MULTI_CARD_HEIGHT,
                              },
                              isNextPick && styles.slotPlaceholderActive,
                            ]}
                          >
                            <Text style={styles.slotPlaceholderIndex}>{i + 1}</Text>
                          </View>
                        )}
                        {flowPhase === "picking" && slotCard && (
                          <TarotCard
                            card={slotCard}
                            flipped={false}
                            width={MULTI_CARD_WIDTH}
                            height={MULTI_CARD_HEIGHT}
                            hideFrontText
                          />
                        )}
                        {(flowPhase === "reveal" || flowPhase === "reading") &&
                          slotCard && (
                          <TarotCard
                            card={slotCard}
                            flipped={
                              flowPhase === "reading" ? true : revealedSlots[i]
                            }
                            width={MULTI_CARD_WIDTH}
                            height={MULTI_CARD_HEIGHT}
                            hideFrontText
                            testID={`reveal-slot-${i}`}
                          />
                        )}
                      </Animated.View>
                    </View>
                    <View style={styles.slotCardTitleWrap}>
                      {showCardNameBelow ? (
                        <Text
                          style={styles.slotCardTitleBelow}
                          numberOfLines={2}
                          testID={`three-card-slot-title-${i}`}
                        >
                          {slotCard!.nameRu}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Single-card picking: centered placeholder + position label (same role as multi slot row) */}
          {flowPhase === "picking" && drawCount === 1 && (
            <View style={styles.slotSingleWrap} testID="one-card-slot">
              <Text
                style={[styles.slotPositionLabel, styles.slotSingleLabel]}
                numberOfLines={2}
              >
                {spread.positions[0].labelRu}
              </Text>
              <View
                ref={(node) => {
                  slotRefs.current[0] = node;
                }}
              >
                <Animated.View
                  entering={FadeInDown.duration(380).springify()}
                  layout={Layout.springify()}
                >
                  {!slots[0] ? (
                    <View
                      style={[
                        styles.slotPlaceholder,
                        {
                          width: SINGLE_FAN_CARD_WIDTH,
                          height: SINGLE_FAN_CARD_HEIGHT,
                        },
                        styles.slotPlaceholderActive,
                      ]}
                    >
                      <Text style={styles.slotPlaceholderIndex}>1</Text>
                    </View>
                  ) : (
                    <TarotCard
                      card={slots[0]}
                      flipped={false}
                      width={SINGLE_FAN_CARD_WIDTH}
                      height={SINGLE_FAN_CARD_HEIGHT}
                      hideFrontText
                    />
                  )}
                </Animated.View>
              </View>
            </View>
          )}

          {flowPhase === "picking" && (
            <PickCardsDeckHint count={drawCount} />
          )}

          {/* Horizontal deck strip — scroll to browse, tap to pick */}
          {flowPhase === "picking" && (
            <Animated.View entering={FadeIn.duration(400)} style={styles.deckStripOuter}>
              <ScrollView
                ref={deckStripRef}
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[
                  styles.deckStripContent,
                  drawCount > 1
                    ? styles.deckStripContentMulti
                    : styles.deckStripContentSingle,
                ]}
                keyboardShouldPersistTaps="handled"
                decelerationRate="fast"
                onScroll={onDeckScroll}
                onLayout={onDeckViewportLayout}
                onContentSizeChange={onDeckContentSizeChange}
                scrollEventThrottle={16}
              >
                {visibleFan.map((c, idx) => {
                  const { fanCardW, fanCardH, fanStep, viewportCenterX } =
                    deckFanLayout;
                  const cardCenterX =
                    DECK_CONTENT_PAD_X + idx * fanStep + fanCardW / 2;
                  const visualOffset =
                    (cardCenterX - viewportCenterX) / fanStep;
                  /** Stable paint order only by strip index — avoids z-order popping when scroll moves the “focus” card (distance-based z used to reshuffle overlaps). Later cards sit above earlier ones at overlaps. */
                  const stackZIndex = idx + 1;
                  return (
                    <Pressable
                      ref={(node) => {
                        deckCardRefs.current[c.id] =
                          node as unknown as View | null;
                      }}
                      key={c.id}
                      onPress={() => handlePickCard(c)}
                      testID={`tarot-card-slot-${idx}`}
                      {...makeDeckCardPanHandlers(c)}
                      style={[
                        styles.deckCardWrap,
                        {
                          marginHorizontal:
                            drawCount > 1 ? -14 : -22,
                          zIndex: stackZIndex,
                          elevation: Math.min(stackZIndex + 4, 22),
                          opacity: pickFlight?.card.id === c.id ? 0 : 1,
                          transform: [
                            { rotate: `${visualOffset * 7}deg` },
                            { translateY: Math.abs(visualOffset) * 8 },
                          ],
                        },
                      ]}
                    >
                      <TarotCard
                        card={c}
                        flipped={false}
                        width={fanCardW}
                        height={fanCardH}
                        hideFrontText={drawCount > 1}
                      />
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Animated.View>
          )}

          {/* Single card: reveal centre */}
          {drawCount === 1 && slots[0] && flowPhase === "reveal" && (
            <Animated.View
              entering={FadeInDown.duration(500).springify()}
              style={styles.pickedWrap}
            >
              <View style={styles.cardGlow} />
              <TarotCard
                card={slots[0] as TarotCardType}
                flipped={revealedSlots[0]}
                width={220}
                height={340}
                testID="picked-card"
              />
            </Animated.View>
          )}

          {/* Reading block */}
          {flowPhase === "reading" && (
            <Animated.View entering={FadeIn.delay(200).duration(450)}>
              {readingSummaryRu ? (
                <GlassCard
                  glow="gold"
                  borderColor={theme.colors.borderGold}
                  style={styles.meaningCard}
                >
                  <View style={styles.meaningInner}>
                    <Text style={styles.summaryEyebrow}>ОБЩИЙ ВЫВОД</Text>
                    <Text style={styles.summaryText}>{readingSummaryRu}</Text>
                  </View>
                </GlassCard>
              ) : null}

              {drawCount === 1 && slots[0] && (
                <View style={styles.readingThumbWrap}>
                  <TarotCard
                    card={slots[0] as TarotCardType}
                    flipped
                    width={132}
                    height={204}
                  />
                </View>
              )}

              {drawCount === 1 && slots[0] && (
                <GlassCard
                  glow="gold"
                  borderColor={theme.colors.borderGold}
                  style={styles.meaningCard}
                >
                  <View style={styles.meaningInner}>
                    <Text style={styles.cardName} testID="card-name">
                      {(slots[0] as TarotCardType).nameRu}
                    </Text>
                    <Text style={styles.cardLatin}>
                      {(slots[0] as TarotCardType).name}
                    </Text>
                    <View style={styles.divider} />
                    <Text style={styles.shortLabel}>Короткое значение</Text>
                    <Text style={styles.shortText} testID="card-short">
                      {(slots[0] as TarotCardType).short}
                    </Text>
                    <View style={styles.dividerThin} />
                    <Text style={styles.shortLabel}>Подробное толкование</Text>
                    <Text style={styles.detailedText} testID="card-detailed">
                      {(slots[0] as TarotCardType).detailed}
                    </Text>
                  </View>
                </GlassCard>
              )}

              {drawCount > 1 &&
                slots.map((card, i) => {
                  if (!card) return null;
                  const pos = spread.positions[i];
                  return (
                    <GlassCard
                      key={pos.id}
                      glow={i === 0 ? "gold" : "purple"}
                      borderColor={
                        i === 0
                          ? theme.colors.borderGold
                          : theme.colors.borderPurple
                      }
                      style={styles.meaningCard}
                    >
                      <View style={styles.meaningInner}>
                        <Text style={styles.positionEyebrow}>
                          {`ПОЗИЦИЯ ${i + 1} · ${pos.labelRu.toUpperCase()}`}
                        </Text>
                        <Text
                          style={styles.cardName}
                          testID={`three-card-name-${i}`}
                        >
                          {card.nameRu}
                        </Text>
                        <Text style={styles.cardLatin}>{card.name}</Text>
                        <View style={styles.divider} />
                        <Text style={styles.shortLabel}>Короткое значение</Text>
                        <Text style={styles.shortText}>{card.short}</Text>
                        <View style={styles.dividerThin} />
                        <Text style={styles.shortLabel}>Подробное толкование</Text>
                        <Text style={styles.detailedText}>{card.detailed}</Text>
                      </View>
                    </GlassCard>
                  );
                })}

              <Text style={styles.savedBadge}>Сохранено в Дневник Судьбы</Text>

              {savedIntuition.length > 0 && (
                <GlassCard
                  borderColor={theme.colors.borderPurple}
                  style={styles.intuitionSavedCard}
                >
                  <View style={{ padding: 18 }}>
                    <Text style={styles.intuitionEyebrow}>МОЁ ТОЛКОВАНИЕ</Text>
                    <Text style={styles.intuitionSavedText}>{savedIntuition}</Text>
                  </View>
                </GlassCard>
              )}

              <Pressable
                onPress={() => setIntuitionOpen(true)}
                testID="intuition-open-btn"
                style={({ pressed }) => [
                  styles.intuitionBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <PenTool color={theme.colors.purple} size={16} />
                <Text style={styles.intuitionBtnText}>Моё толкование</Text>
              </Pressable>

              <Pressable
                onPress={resetSpread}
                testID="tarot-reset-btn"
                style={({ pressed }) => [
                  styles.resetBtn,
                  pressed && { transform: [{ scale: 0.98 }] },
                ]}
              >
                <Layers color={theme.colors.text} size={16} />
                <Text style={styles.resetBtnText}>Новый расклад</Text>
              </Pressable>
            </Animated.View>
          )}

          <View style={{ height: 140 }} />
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {pickFlight ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pickFlightCard,
            {
              width: pickFlight.width,
              height: pickFlight.height,
            },
            pickFlightStyle,
          ]}
        >
          <TarotCard
            card={pickFlight.card}
            flipped={false}
            width={pickFlight.width}
            height={pickFlight.height}
            hideFrontText={pickFlight.hideFrontText}
          />
        </Animated.View>
      ) : null}

      <Modal
        visible={intuitionOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIntuitionOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalRoot}
        >
          <Animated.View
            entering={FadeIn.duration(250)}
            exiting={FadeOut.duration(200)}
            style={styles.modalBackdrop}
          />
          <Animated.View
            entering={FadeInDown.duration(300).springify()}
            style={styles.modalCardWrap}
          >
            <GlassCard
              glow="purple"
              borderColor={theme.colors.borderPurple}
              style={{ width: "100%" }}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Моё толкование</Text>
                  <Pressable
                    onPress={() => setIntuitionOpen(false)}
                    testID="intuition-close-btn"
                  >
                    <X color={theme.colors.textDim} size={22} />
                  </Pressable>
                </View>
                <Text style={styles.modalSubtitle}>{intuitionModalSubtitle}</Text>
                <TextInput
                  testID="intuition-input"
                  value={intuitionText}
                  onChangeText={setIntuitionText}
                  placeholder={
                    drawCount === 1
                      ? "Что я чувствую, глядя на эту карту?"
                      : "Какая история складывается у меня внутри?"
                  }
                  placeholderTextColor={theme.colors.textDim}
                  multiline
                  style={styles.modalInput}
                />
                <Pressable
                  onPress={saveIntuition}
                  testID="intuition-save-btn"
                  style={({ pressed }) => [
                    styles.modalBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.modalBtnText}>Сохранить</Text>
                </Pressable>
              </View>
            </GlassCard>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg, position: "relative" },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 0 },
  scrollPickingLocked: {
    flexGrow: 1,
  },
  /** Вне вертикального ScrollView: полоса колоды с z-index не перекрывает кнопку. */
  topBackBar: {
    paddingHorizontal: 24,
    paddingBottom: 2,
    zIndex: 24,
    elevation: 24,
  },
  topBackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginBottom: 2,
    paddingVertical: 4,
    paddingRight: 12,
  },
  topBackLabel: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 14,
  },
  eyebrow: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 3,
    color: theme.colors.gold,
    marginTop: 8,
  },
  eyebrowTightTop: {
    marginTop: 2,
  },
  heroCopy: {
    paddingTop: 14,
    alignItems: "center",
  },
  heroDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    opacity: 0.68,
  },
  heroDividerLine: {
    width: 54,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.borderGold,
  },
  heroDividerStar: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.heading,
    fontSize: 14,
  },
  title: {
    fontFamily: theme.fonts.display,
    color: theme.colors.text,
    fontSize: 34,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  subtitle: {
    color: theme.colors.lilac,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    marginTop: 6,
    marginBottom: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 240,
  },
  selectIntro: {
    marginTop: 4,
    marginBottom: 14,
    paddingVertical: 2,
  },
  selectIntroTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 15,
    letterSpacing: 0.2,
  },
  selectIntroText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  spreadPickerCol: {
    gap: 14,
    marginBottom: 18,
  },
  spreadOption: {
    minHeight: 228,
    padding: 18,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "transparent",
    overflow: "hidden",
    ...theme.shadows.card,
  },
  spreadOptionBgImage: {
    ...StyleSheet.absoluteFillObject,
  },
  spreadOptionBgScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,3,12,0.18)",
  },
  spreadOptionCompact: {
    minHeight: 212,
    padding: 16,
  },
  spreadOptionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 1,
  },
  spreadIconPill: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    backgroundColor: "rgba(255,215,154,0.08)",
  },
  spreadOptionCopy: {
    zIndex: 1,
    marginTop: 14,
  },
  spreadOptionTitle: {
    color: theme.colors.lilac,
    fontFamily: theme.fonts.headingBold,
    fontSize: 23,
    lineHeight: 27,
    textShadowColor: "rgba(5,3,12,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  spreadOptionSubtitle: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    opacity: 0.92,
    textShadowColor: "rgba(5,3,12,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  spreadOptionBadge: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,215,154,0.22)",
    backgroundColor: "rgba(255,215,154,0.08)",
    overflow: "hidden",
    textShadowColor: "rgba(5,3,12,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  schemePanel: {
    marginTop: 8,
    borderRadius: 26,
    borderWidth: 0,
    backgroundColor: "transparent",
    overflow: "visible",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  schemePanelRoomy: {
    minHeight: 142,
  },
  schemePanelCompact: {
    minHeight: 128,
  },
  schemeSingleWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  schemeRowThree: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  schemeRowCardLeft: {
    marginRight: 8,
  },
  schemeRowCardMid: {
    marginHorizontal: 8,
  },
  schemeRowCardRight: {
    marginLeft: 8,
  },
  schemeMiniCard: {
    borderRadius: 9,
    borderWidth: 1.4,
    borderColor: "rgba(255,247,234,0.78)",
    backgroundColor: "rgba(5,4,11,0.52)",
    shadowColor: "#05030D",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 6,
  },
  schemeMiniCardLarge: {
    width: 42,
    height: 64,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  schemeMiniCardCompact: {
    width: 38,
    height: 58,
    borderRadius: 9,
    borderWidth: 1.4,
  },
  schemeMiniCardActive: {
    borderColor: "rgba(255,215,154,0.92)",
    backgroundColor: "rgba(13,10,25,0.64)",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: theme.colors.mauve,
    paddingVertical: 16,
    borderRadius: 999,
    marginTop: 6,
    marginBottom: 8,
    shadowColor: theme.colors.mauve,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryBtnText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  pickDeckHint: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  pickDeckHintText: {
    color: theme.colors.lilac,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
    letterSpacing: 0.4,
    textAlign: "center",
  },
  pickDeckPointerWrap: {
    marginTop: 2,
  },
  slotsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 46,
    paddingHorizontal: 4,
    marginTop: 10,
    marginBottom: 6,
  },
  /** One-card spread: mirrors vertical space of `slotsRow` so the deck sits lower like 3-card flow */
  slotSingleWrap: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  slotSingleLabel: {
    maxWidth: 280,
  },
  slotCol: { flex: 1, alignItems: "center" },
  slotPlaceholder: {
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  slotPlaceholderActive: {
    borderColor: theme.colors.borderGold,
    backgroundColor: theme.colors.goldSoft,
  },
  slotPlaceholderIndex: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.headingBold,
    fontSize: 28,
    opacity: 0.5,
  },
  slotPositionLabel: {
    marginBottom: 8,
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    textAlign: "center",
    width: "100%",
  },
  slotCardTitleWrap: {
    marginTop: 8,
    minHeight: 38,
    width: "100%",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  slotCardTitleBelow: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 13,
    lineHeight: 17,
    textAlign: "center",
  },
  deckStripOuter: {
    marginHorizontal: -24,
    marginTop: 4,
    marginBottom: 12,
  },
  deckStripContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 24,
  },
  deckStripContentMulti: {
    paddingVertical: 28,
    minHeight: MULTI_CARD_HEIGHT + 52,
  },
  deckStripContentSingle: {
    paddingVertical: 28,
    minHeight: SINGLE_FAN_CARD_HEIGHT + 52,
  },
  deckCardWrap: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
  pickFlightCard: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 200,
    elevation: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
  },
  pickedWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 360,
    marginVertical: 16,
  },
  cardGlow: {
    position: "absolute",
    width: 280,
    height: 380,
    borderRadius: 200,
    backgroundColor: "rgba(239,160,192,0.10)",
    shadowColor: theme.colors.mauve,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 34,
  },
  meaningCard: { marginTop: 12 },
  meaningInner: { padding: 22 },
  summaryEyebrow: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 2.5,
    textAlign: "center",
    marginBottom: 10,
  },
  summaryText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 17,
    lineHeight: 25,
    textAlign: "center",
    fontStyle: "italic",
  },
  readingThumbWrap: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 4,
  },
  savedBadge: {
    marginTop: 12,
    textAlign: "center",
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  positionEyebrow: {
    color: theme.colors.mauve,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 2.2,
    textAlign: "center",
    marginBottom: 8,
  },
  cardName: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.display,
    fontSize: 26,
    textAlign: "center",
  },
  cardLatin: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    letterSpacing: 3,
    textAlign: "center",
    marginTop: 4,
    textTransform: "uppercase",
  },
  divider: {
    height: 1,
    width: 60,
    alignSelf: "center",
    backgroundColor: "rgba(255,215,154,0.5)",
    marginVertical: 16,
  },
  dividerThin: {
    height: 1,
    backgroundColor: "rgba(255,247,234,0.1)",
    marginVertical: 16,
  },
  shortLabel: {
    color: theme.colors.mauve,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 8,
  },
  shortText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontStyle: "italic",
    fontSize: 17,
    lineHeight: 24,
  },
  detailedText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.9,
  },
  intuitionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderPurple,
    backgroundColor: theme.colors.surfaceGlass,
    marginTop: 16,
  },
  intuitionBtnText: {
    color: theme.colors.mauve,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
    letterSpacing: 1,
  },
  intuitionSavedCard: { marginTop: 12 },
  intuitionEyebrow: {
    color: theme.colors.mauve,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 8,
  },
  intuitionSavedText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontStyle: "italic",
    fontSize: 16,
    lineHeight: 22,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: theme.colors.mauve,
    marginTop: 16,
  },
  resetBtnText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,6,18,0.76)",
  },
  modalCardWrap: {
    width: "100%",
  },
  modalContent: {
    padding: 22,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.headingBold,
    fontSize: 22,
  },
  modalSubtitle: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 16,
  },
  modalInput: {
    minHeight: 120,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 15,
    backgroundColor: "rgba(255,247,234,0.05)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderPurple,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  modalBtn: {
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: theme.colors.mauve,
    alignItems: "center",
  },
  modalBtnText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
});
