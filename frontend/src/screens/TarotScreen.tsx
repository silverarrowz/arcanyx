import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  ScrollView as GestureScrollView,
} from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
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
import { useRouter, useScrollToTop } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  Layers,
  PenTool,
  X,
  Sparkles,
  ArrowLeft,
  ChevronDown,
  Check,
  ArrowRight,
  RefreshCw,
  Share,
} from "lucide-react-native";
import { theme } from "../theme";
import CosmicBackground from "../components/CosmicBackground";
import GlassCard from "../components/GlassCard";
import ScreenHeading from "../components/ScreenHeading";
import TarotCard from "../components/TarotCard";
import { TAROT_DECK } from "../data/tarotCards";
import {
  OrientedTarotCard,
  cardDetailed,
  cardShort,
  cardTitleRu,
  withOrientation,
} from "../data/tarotOrientation";
import {
  DEFAULT_SPREAD_ID,
  TarotSpread,
  historicalSpreadFallback,
} from "../data/tarotSpreads";
import { buildTarotSummaryRu } from "../data/tarotReadingSummary";
import { getCardReading } from "../data/tarotReadings";
import {
  HistoryItem,
  TarotCardSnapshot,
  useHistory,
} from "../context/HistoryContext";
import { useUser } from "../context/UserContext";
import { useTarotSpreads } from "../context/TarotSpreadsContext";
import ProModal from "../components/profile/ProModal";
import RemainPill from "../components/RemainPill";
import ShareSpreadPoster from "../components/ShareSpreadPoster";
import { SHARE_POSTER_H, SHARE_POSTER_W } from "../components/ShareCardPoster";
import {
  canOpenTarotInterpret,
  getTarotInterpretQuota,
} from "../services/tarotChat";
import { shareViewAsImage } from "../services/sharePoster";

type FlowPhase = "select" | "picking" | "reveal" | "reading";

/** «выберите 3 карты» — склонение числа для подсказки у колоды */
function chooseCardsPhraseRu(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `нажмите или вытяните ${n} карту`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return `нажмите или вытяните ${n} карты`;
  return `нажмите или вытяните ${n} карт`;
}

function cardCountLabelRu(n: number): string {
  if (n === 1) return "1 карта";
  if (n >= 2 && n <= 4) return `${n} карты`;
  return `${n} карт`;
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

function shuffleFan(count: number = FAN_POOL_SIZE): OrientedTarotCard[] {
  const arr = [...TAROT_DECK];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count).map((card) => withOrientation(card));
}

function cardsFromHistoryItem(item: HistoryItem): (OrientedTarotCard | null)[] {
  if (item.cardsSnapshot && item.cardsSnapshot.length > 0) {
    return item.cardsSnapshot.map((snap) => {
      const card = TAROT_DECK.find((c) => c.id === snap.cardId);
      if (!card) return null;
      return withOrientation(card, snap.reversed === true);
    });
  }
  if (item.cardId) {
    const card = TAROT_DECK.find((c) => c.id === item.cardId);
    if (!card) return [null];
    return [withOrientation(card, item.cardReversed === true)];
  }
  return [];
}

const DEFAULT_SPREAD_BG = require("../../assets/tarot/bg/bgi1.jpg");

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

  if (spread.drawCount === 1) {
    return (
      <View style={panelStyle} pointerEvents="none">
        <View style={styles.schemeSingleWrap}>
          <SchemeSilhouette active={active} style={silhouetteStyle} />
        </View>
      </View>
    );
  }

  if (spread.drawCount === 2) {
    return (
      <View style={panelStyle} pointerEvents="none">
        <View style={styles.schemeRowThree}>
          <SchemeSilhouette active={active} rotate="-4deg" style={[styles.schemeRowCardLeft, silhouetteStyle]} />
          <SchemeSilhouette active={active} rotate="4deg" style={[styles.schemeRowCardRight, silhouetteStyle]} />
        </View>
      </View>
    );
  }

  if (spread.drawCount === 4) {
    return (
      <View style={panelStyle} pointerEvents="none">
        <View style={[styles.schemeRowThree, { flexWrap: "wrap", width: 100, gap: 6 }]}>
          <SchemeSilhouette active={active} style={silhouetteStyle} />
          <SchemeSilhouette active={active} style={silhouetteStyle} />
          <SchemeSilhouette active={active} style={silhouetteStyle} />
          <SchemeSilhouette active={active} style={silhouetteStyle} />
        </View>
      </View>
    );
  }

  if (spread.drawCount === 5) {
    return (
      <View style={panelStyle} pointerEvents="none">
        <View style={[styles.schemeRowThree, { flexWrap: "wrap", width: 140, gap: 6 }]}>
          <SchemeSilhouette active={active} style={silhouetteStyle} />
          <SchemeSilhouette active={active} style={silhouetteStyle} />
          <SchemeSilhouette active={active} style={silhouetteStyle} />
          <SchemeSilhouette active={active} style={silhouetteStyle} />
          <SchemeSilhouette active={active} style={[silhouetteStyle, { marginTop: -4 }]} />
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
  /** When set, restore this diary entry into the reading view. */
  historyId?: string;
};

type Rect = { x: number; y: number; width: number; height: number };

type PickFlight = {
  card: OrientedTarotCard;
  width: number;
  height: number;
  hideFrontText: boolean;
};

export default function TarotScreen({
  embedded = false,
  historyId,
}: TarotScreenProps) {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { addItem, updateItem, items, hydrated } = useHistory();
  const { isPro } = useUser();
  const { spreads, getSpreadById } = useTarotSpreads();
  const [proVisible, setProVisible] = useState(false);
  const revealTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const appliedArchiveRef = useRef(false);
  const [historyItemId, setHistoryItemId] = useState<string | null>(
    historyId ?? null,
  );
  const [archiveTitle, setArchiveTitle] = useState<string | null>(null);
  const [archiveMissing, setArchiveMissing] = useState(false);
  const [archiveReady, setArchiveReady] = useState(!historyId);
  const [spreadId, setSpreadId] = useState<TarotSpread["id"]>(DEFAULT_SPREAD_ID);
  const spread = useMemo(
    () => getSpreadById(spreadId),
    [getSpreadById, spreadId],
  );

  const [flowPhase, setFlowPhase] = useState<FlowPhase>("select");
  const [readingSummaryRu, setReadingSummaryRu] = useState<string | null>(
    null,
  );

  const [fan, setFan] = useState<OrientedTarotCard[]>(() => shuffleFan());
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [slots, setSlots] = useState<(OrientedTarotCard | null)[]>(() =>
    Array(spread.drawCount).fill(null),
  );
  const [revealedSlots, setRevealedSlots] = useState<boolean[]>(() =>
    Array(spread.drawCount).fill(false),
  );

  const [intuitionOpen, setIntuitionOpen] = useState(false);
  const [intuitionText, setIntuitionText] = useState("");
  const [previewCard, setPreviewCard] = useState<OrientedTarotCard | null>(null);
  const [savedIntuition, setSavedIntuition] = useState<string>("");
  const [intuitionJustSaved, setIntuitionJustSaved] = useState(false);

  /** Deck strip: scroll-linked fan so the arc is always centered on the viewport. */
  const [deckScrollX, setDeckScrollX] = useState(0);
  const [deckViewportW, setDeckViewportW] = useState(width);
  const [deckContentWidth, setDeckContentWidth] = useState(0);
  const rootRef = useRef<View>(null);
  const mainScrollRef = useRef<ScrollView>(null);
  useScrollToTop(mainScrollRef);
  const deckStripRef = useRef<ScrollView>(null);
  const deckCardRefs = useRef<Record<string, View | null>>({});
  const slotRefs = useRef<Record<number, View | null>>({});
  /** One-shot center scroll each time user enters picking (not after each pick). */
  const deckNeedsInitialCenterRef = useRef(false);
  const isPickAnimatingRef = useRef(false);
  const pickFlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const intuitionSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const dragSourceRectRef = useRef<Rect | null>(null);
  const draggingCardRef = useRef<OrientedTarotCard | null>(null);
  const dragTranslationRef = useRef({ x: 0, y: 0 });
  const [pickFlight, setPickFlight] = useState<PickFlight | null>(null);
  const flightX = useSharedValue(0);
  const flightY = useSharedValue(0);
  const flightScale = useSharedValue(1);
  const flightOpacity = useSharedValue(0);
  const sharePosterRef = useRef<View>(null);
  const shareImageReadyRef = useRef(false);
  const [sharing, setSharing] = useState(false);

  const drawCount = spread.drawCount;
  const nextSlotIndex = slots.findIndex((s) => s === null);
  const allPicked = nextSlotIndex === -1;

  const availableW = width - 56;
  const cardsPerRow =
    drawCount === 4 || drawCount === 2 ? 2 : drawCount >= 3 ? 3 : 1;
  const gapSum = cardsPerRow === 3 ? 16 : cardsPerRow === 2 ? 32 : 0;
  const dynamicCardWidth = Math.min(118, (availableW - gapSum) / cardsPerRow);
  const compactSlots = drawCount >= 4 && flowPhase !== "reading";
  const compactGap = 8;
  const compactCardWidth = Math.min(
    drawCount === 4 ? 72 : 62,
    (availableW - compactGap * (drawCount - 1)) / drawCount,
  );
  const denseResult = drawCount >= 4 && flowPhase === "reading";
  const fiveCardResult = drawCount === 5 && flowPhase === "reading";
  const fourCardResult = drawCount === 4 && flowPhase === "reading";
  const threeCardLayout = drawCount === 3;
  const denseResultCardWidth = drawCount === 5 ? 82 : 88;
  const slotCardWidth = compactSlots
    ? compactCardWidth
    : denseResult
      ? denseResultCardWidth
      : dynamicCardWidth;
  const slotCardHeight = slotCardWidth * (182 / 118);
  const crossCellWidth = 96;
  const crossAreaWidth = width - 48;
  const crossCenterLeft = (crossAreaWidth - crossCellWidth) / 2;

  const fiveCardSlotStyle = (index: number): ViewStyle => {
    if (!fiveCardResult) return {};
    if (index === 0) {
      return { position: "absolute", top: 0, left: 0 };
    }
    if (index === 1) {
      return { position: "absolute", top: 0, right: 0 };
    }
    if (index === 2) {
      return { position: "absolute", top: 112, left: crossCenterLeft };
    }
    if (index === 3) {
      return { position: "absolute", top: 224, left: 0 };
    }
    return { position: "absolute", top: 224, right: 0 };
  };

  const clearRevealTimers = useCallback(() => {
    revealTimeoutsRef.current.forEach((timerId) => clearTimeout(timerId));
    revealTimeoutsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearRevealTimers();
      if (intuitionSaveTimerRef.current) {
        clearTimeout(intuitionSaveTimerRef.current);
      }
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
      setIntuitionJustSaved(false);
      setReadingSummaryRu(null);
      setHistoryItemId(null);
      setArchiveTitle(null);
    },
    [clearRevealTimers, getSpreadById],
  );

  useEffect(() => {
    if (!historyId || !hydrated || appliedArchiveRef.current) return;
    appliedArchiveRef.current = true;
    const item = items.find((it) => it.id === historyId && it.type === "tarot");
    if (!item) {
      setArchiveMissing(true);
      setArchiveReady(true);
      return;
    }

    const cards = cardsFromHistoryItem(item);
    const requestedSpreadId =
      item.spread ?? (cards.length <= 1 ? "one-card" : "three-situation");
    const catalogSpread = getSpreadById(requestedSpreadId);
    const historicalSpread = item.cardsSnapshot?.length
      ? historicalSpreadFallback(
          requestedSpreadId === "three-card"
            ? "three-situation"
            : requestedSpreadId,
          item.spreadLabelRu || item.question || catalogSpread.titleRu,
          item.cardsSnapshot.map((snapshot, index) => ({
            id:
              snapshot.positionId ||
              catalogSpread.positions[index]?.id ||
              `position-${index + 1}`,
            labelRu:
              snapshot.positionLabelRu ||
              catalogSpread.positions[index]?.labelRu ||
              `Карта ${index + 1}`,
          })),
        )
      : null;
    const nextSpread = historicalSpread ?? catalogSpread;
    const nextSlots = nextSpread.positions.map((_, i) => cards[i] ?? null);
    const note = item.userInterpretation?.trim() ?? "";

    setSpreadId(nextSpread.id);
    setSlots(nextSlots);
    setRevealedSlots(nextSlots.map((card) => card != null));
    setPickedIds(nextSlots.filter((card): card is OrientedTarotCard => card != null).map((c) => c.id));
    setFlowPhase("reading");
    setReadingSummaryRu(item.tarotSummaryRu ?? null);
    setSavedIntuition(note);
    setIntuitionText(note);
    setHistoryItemId(item.id);
    setArchiveTitle(item.spreadLabelRu || item.question || nextSpread.titleRu);
    setArchiveReady(true);
  }, [getSpreadById, historyId, hydrated, items]);

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
    if (historyId) {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/diary");
      return;
    }
    resetSession(spread);
  }, [historyId, resetSession, router, spread]);

  const commitHistory = useCallback(
    (filledSlots: OrientedTarotCard[], summaryRu: string) => {
      const snapshot: TarotCardSnapshot[] = filledSlots.map((c, i) => ({
        positionId: spread.positions[i].id,
        positionLabelRu: spread.positions[i].labelRu,
        cardId: c.id,
        cardName: cardTitleRu(c, c.reversed),
        reversed: c.reversed,
      }));

      let question: string;
      let answer: string;

      if (drawCount === 1) {
        const c = filledSlots[0];
        question = spread.titleRu;
        answer = `${cardTitleRu(c, c.reversed)} — ${cardShort(c, c.reversed)}`;
      } else {
        question = spread.titleRu;
        answer = filledSlots
          .map((c, i) => `${spread.positions[i].labelRu}: ${cardTitleRu(c, c.reversed)}`)
          .join(" · ");
      }

      const id = addItem({
        type: "tarot",
        question,
        answer,
        cardId: drawCount === 1 ? filledSlots[0].id : undefined,
        cardName: drawCount === 1 ? cardTitleRu(filledSlots[0], filledSlots[0].reversed) : undefined,
        cardReversed: drawCount === 1 ? filledSlots[0].reversed : undefined,
        spread: spread.id,
        spreadLabelRu: spread.titleRu,
        cardsSnapshot: snapshot,
        tarotSummaryRu: summaryRu,
      });
      setHistoryItemId(id);
    },
    [addItem, spread, drawCount],
  );

  const startAutoReveal = useCallback(
    (filledSlots: OrientedTarotCard[]) => {
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
    (card: OrientedTarotCard, idx: number) => {
      const nextSlots = [...slots];
      nextSlots[idx] = card;
      const nextPickedIds = [...pickedIds, card.id];

      setSlots(nextSlots);
      setPickedIds(nextPickedIds);

      const filledCount = nextSlots.filter(Boolean).length;
      if (filledCount === drawCount) {
        startAutoReveal(nextSlots as OrientedTarotCard[]);
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
    dragTranslationRef.current = { x: 0, y: 0 };
    isPickAnimatingRef.current = false;
    flightOpacity.value = 0;
    setPickFlight(null);
  }, [flightOpacity]);

  const animatePickToSlot = useCallback(
    (
      card: OrientedTarotCard,
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

  const handlePickCard = useCallback((card: OrientedTarotCard) => {
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
    (card: OrientedTarotCard) => {
      if (flowPhase !== "picking") return;
      if (pickedIds.includes(card.id) || allPicked) return;
      if (isPickAnimatingRef.current) return;

      const sourceNode = deckCardRefs.current[card.id];
      isPickAnimatingRef.current = true;
      draggingCardRef.current = card;
      dragTranslationRef.current = { x: 0, y: 0 };

      measureRelativeToRoot(sourceNode, (sourceRect) => {
        if (!sourceRect || draggingCardRef.current?.id !== card.id) {
          resetPickFlight();
          return;
        }
        dragSourceRectRef.current = sourceRect;
        const translation = dragTranslationRef.current;
        setPickFlight({
          card,
          width: sourceRect.width,
          height: sourceRect.height,
          hideFrontText: drawCount > 1,
        });
        flightX.value = sourceRect.x + translation.x;
        flightY.value = sourceRect.y + translation.y;
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
    (translationX: number, translationY: number) => {
      dragTranslationRef.current = { x: translationX, y: translationY };
      const sourceRect = dragSourceRectRef.current;
      if (!sourceRect || !draggingCardRef.current) return;
      flightX.value = sourceRect.x + translationX;
      flightY.value = sourceRect.y + translationY;
      flightScale.value = 1.07;
    },
    [flightScale, flightX, flightY],
  );

  const finishDraggedCard = useCallback(
    (translationX: number, translationY: number) => {
      dragTranslationRef.current = { x: translationX, y: translationY };
      const card = draggingCardRef.current;
      const sourceRect = dragSourceRectRef.current;
      const idx = slots.findIndex((s) => s === null);
      if (!card || idx === -1) {
        resetPickFlight();
        return;
      }

      // A very quick pull can finish before native measurement returns.
      // It is still an intentional draw, so accept it without the flight animation.
      if (!sourceRect) {
        if (translationY < -32) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          commitPickedCard(card, idx);
        }
        resetPickFlight();
        return;
      }

      const currentRect = {
        ...sourceRect,
        x: sourceRect.x + translationX,
        y: sourceRect.y + translationY,
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
        const pulledFromDeck = translationY < -54;

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
      commitPickedCard,
      flightOpacity,
      flightScale,
      flightX,
      flightY,
      measureRelativeToRoot,
      resetPickFlight,
      slots,
    ],
  );

  const makeDeckCardDragGesture = useCallback(
    (card: OrientedTarotCard) =>
      Gesture.Pan()
        .enabled(flowPhase === "picking")
        .runOnJS(true)
        // Horizontal movement remains available to the deck ScrollView.
        .activeOffsetY(-8)
        .failOffsetX([-24, 24])
        .onStart(() => beginDragCard(card))
        .onUpdate((event) =>
          updateDraggedCard(event.translationX, event.translationY),
        )
        .onFinalize((event, success) => {
          if (success) {
            finishDraggedCard(event.translationX, event.translationY);
          } else if (draggingCardRef.current?.id === card.id) {
            // Clean up only a drag that had actually activated. A normal tap
            // also finalizes the pan recognizer with `success = false`.
            resetPickFlight();
          }
        }),
    [
      beginDragCard,
      finishDraggedCard,
      flowPhase,
      resetPickFlight,
      updateDraggedCard,
    ],
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
    if (intuitionJustSaved) return;
    const text = intuitionText.trim();
    setSavedIntuition(text);
    if (historyItemId) {
      updateItem(historyItemId, {
        userInterpretation: text.length > 0 ? text : undefined,
      });
    }
    setIntuitionJustSaved(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    if (intuitionSaveTimerRef.current) {
      clearTimeout(intuitionSaveTimerRef.current);
    }
    intuitionSaveTimerRef.current = setTimeout(() => {
      setIntuitionOpen(false);
      setIntuitionJustSaved(false);
      intuitionSaveTimerRef.current = null;
    }, 650);
  };

  const closeIntuitionModal = () => {
    setIntuitionText(savedIntuition);
    setIntuitionJustSaved(false);
    setIntuitionOpen(false);
  };

  const subtitle = useMemo(() => {
    switch (flowPhase) {
      case "select":
        return "Расклады на любые случаи жизни";
      case "picking":
        return `Выбрано ${pickedIds.length} из ${drawCount} · листайте колоду`;
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


  const pickingOrRevealOrReading =
    flowPhase === "picking" ||
    flowPhase === "reveal" ||
    flowPhase === "reading";
  const compactSpreadCards = width < 370;
  const viewingArchive = Boolean(historyId);
  const currentHistoryItem = useMemo(
    () => items.find((it) => it.id === historyItemId && it.type === "tarot"),
    [historyItemId, items],
  );
  const chatStarted = Boolean(currentHistoryItem?.tarotChat?.conversationId);
  const interpretQuota = useMemo(
    () => getTarotInterpretQuota({ isPro, items }),
    [isPro, items],
  );
  const shareSlots = useMemo(
    () =>
      spread.positions
        .map((pos, i) => {
          const card = slots[i];
          if (!card) return null;
          return { card, positionLabelRu: pos.labelRu, reversed: card.reversed };
        })
        .filter(
          (slot): slot is {
            card: OrientedTarotCard;
            positionLabelRu: string;
            reversed: boolean;
          } => slot != null,
        ),
    [slots, spread.positions],
  );
  const shareCaption = useMemo(() => {
    if (shareSlots.length === 0) return undefined;
    if (shareSlots.length === 1) {
      const slot = shareSlots[0];
      return getCardReading(slot.card, slot.reversed).quote;
    }
    return shareSlots
      .map(
        (slot) =>
          `${slot.positionLabelRu}: ${cardTitleRu(slot.card, slot.reversed)}`,
      )
      .join(" · ");
  }, [shareSlots]);
  const sharePosterKey = shareSlots
    .map((slot) => `${slot.card.id}:${slot.reversed ? "r" : "u"}`)
    .join("-");

  useEffect(() => {
    shareImageReadyRef.current = false;
  }, [sharePosterKey]);

  const handleShareSpread = useCallback(async () => {
    if (shareSlots.length === 0 || sharing) return;
    const fallback =
      shareSlots.length === 1
        ? `Мой расклад «${spread.titleRu}»: ${cardTitleRu(shareSlots[0].card, shareSlots[0].reversed)}\n«${shareCaption ?? cardShort(shareSlots[0].card, shareSlots[0].reversed)}»`
        : `Мой расклад «${spread.titleRu}»: ${shareCaption}`;
    setSharing(true);
    Haptics.selectionAsync().catch(() => {});
    try {
      await shareViewAsImage(
        sharePosterRef,
        fallback,
        () => shareImageReadyRef.current,
        "Поделиться раскладом",
      );
    } catch {
      // ignore cancel
    } finally {
      setSharing(false);
    }
  }, [shareCaption, shareSlots, sharing, spread.titleRu]);

  const openTarotChat = useCallback(() => {
    if (!historyItemId) return;
    const allowed = canOpenTarotInterpret({
      isPro,
      items,
      chatAlreadyStarted: chatStarted,
    });
    if (!allowed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
      setProVisible(true);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    router.push(
      `/tarot-chat?id=${encodeURIComponent(historyItemId)}` as never,
    );
  }, [chatStarted, historyItemId, isPro, items, router]);
  const intuitionSaved = savedIntuition.length > 0;
  const modalShowsSaved =
    intuitionJustSaved ||
    (intuitionSaved && intuitionText.trim() === savedIntuition);

  if (viewingArchive && !archiveReady) {
    return (
      <View style={styles.root}>
        <CosmicBackground variant="tarot" />
      </View>
    );
  }

  if (viewingArchive && archiveMissing) {
    return (
      <View style={styles.root}>
        <CosmicBackground variant="tarot" />
        <SafeAreaView
          style={styles.safe}
          edges={embedded ? ["bottom"] : ["top"]}
        >
          <View style={styles.topBackBar} pointerEvents="box-none">
            <Pressable
              onPress={goBackToSelect}
              testID="tarot-top-back"
              accessibilityRole="button"
              accessibilityLabel="Назад"
              style={({ pressed }) => [
                styles.topBackRow,
                pressed && { opacity: 0.82 },
              ]}
            >
              <ArrowLeft color={theme.colors.textDim} size={20} />
              <Text style={styles.topBackLabel}>Назад</Text>
            </Pressable>
          </View>
          <View style={styles.archiveEmpty}>
            <Text style={styles.archiveEmptyTitle}>Расклад не найден</Text>
            <Text style={styles.archiveEmptyText}>
              Эта запись больше не сохранена в дневнике.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View
      ref={rootRef}
      style={[styles.root, embedded && styles.rootEmbedded]}
    >
      {flowPhase === "reading" && shareSlots.length > 0 ? (
        <View style={styles.shareOffscreen} pointerEvents="none">
          <ShareSpreadPoster
            key={sharePosterKey}
            ref={sharePosterRef}
            spreadTitleRu={spread.titleRu}
            slots={shareSlots}
            caption={shareCaption}
            onImageReady={() => {
              shareImageReadyRef.current = true;
            }}
          />
        </View>
      ) : null}
      {/* When embedded, the Гадания shell paints the backdrop so it also spans the segment header. */}
      {embedded ? null : <CosmicBackground variant="tarot" />}
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
                accessibilityLabel={viewingArchive ? "Назад" : "К выбору расклада"}
                style={({ pressed }) => [
                  styles.topBackRow,
                  pressed && { opacity: 0.82 },
                ]}
              >
                <ArrowLeft color={theme.colors.textDim} size={20} />
                <Text style={styles.topBackLabel}>
                  {viewingArchive ? "Назад" : "К раскладам"}
                </Text>
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
          <ScreenHeading
            title={
              flowPhase === "select"
                ? "Таро"
                : archiveTitle ?? spread.titleRu
            }
            deck={subtitle || undefined}
            size={flowPhase !== "select" ? "md" : "lg"}
            titleStyle={flowPhase !== "select" ? styles.titleReading : undefined}
            style={styles.heroCopy}
          />

          {/* ——— Select spread ——— */}
          {flowPhase === "select" && (
            <Animated.View entering={FadeIn.duration(380)}>
              {/* <View style={styles.selectIntro}>
                <Text style={styles.selectIntroTitle}>Выберите форму расклада</Text>
                <Text style={styles.selectIntroText}>
                  Схема на карточке — позиции расклада. Коснитесь карточки, чтобы
                  сразу перейти к выбору карт.
                </Text>
              </View> */}

              <View style={styles.spreadPickerCol} testID="spread-picker">
                {spreads.map((s) => {
                  const spreadBg = s.coverUrl
                    ? { uri: s.coverUrl }
                    : DEFAULT_SPREAD_BG;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => handleSelectSpreadAndStart(s.id)}
                      testID={`spread-chip-${s.id}`}
                      style={({ pressed }) => [
                        pressed && { transform: [{ scale: 0.985 }] },
                      ]}
                    >
                      <ImageBackground
                        source={spreadBg}
                        style={[
                          styles.spreadOption,
                          compactSpreadCards && styles.spreadOptionCompact,
                        ]}
                        imageStyle={styles.spreadOptionBgImage}
                        resizeMode="cover"
                      >
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
                            {cardCountLabelRu(s.drawCount)}
                          </Text>
                        </View>

                        <SpreadSchemePreview spread={s} active={false} />

                        <View style={styles.spreadOptionCopy}>
                          <Text
                            style={styles.spreadOptionTitle}
                            numberOfLines={2}
                          >
                            {s.titleRu}
                          </Text>
                          <Text
                            style={styles.spreadOptionSubtitle}
                            numberOfLines={2}
                          >
                            {s.subtitleRu}
                          </Text>
                        </View>
                      </ImageBackground>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {/* Slot row: picking (placeholder / face-down preview of assigned not shown until reveal) */}
          {pickingOrRevealOrReading && drawCount > 1 && (
            <View
              key={
                compactSlots
                  ? "compact-slots"
                  : fiveCardResult
                    ? "five-card-result"
                    : fourCardResult
                      ? "four-card-result"
                      : "regular-slots"
              }
              style={[
                styles.slotsRow,
                compactSlots && styles.slotsRowCompact,
                threeCardLayout && styles.slotsRowThree,
                fourCardResult && styles.slotsRowFourResult,
                fiveCardResult && styles.slotsRowFiveResult,
              ]}
            >
              {spread.positions.map((pos, i) => {
                const slotCard = slots[i];
                const isNextPick =
                  flowPhase === "picking" && i === nextSlotIndex;
                const showCardNameBelow =
                  !!slotCard &&
                  (flowPhase === "reading" ||
                    (flowPhase === "reveal" && revealedSlots[i]));
                let slotColumnStyle: ViewStyle;
                if (compactSlots) {
                  slotColumnStyle = {
                    flex: 0,
                    width: slotCardWidth,
                    minWidth: slotCardWidth,
                  };
                } else if (fiveCardResult) {
                  slotColumnStyle = {
                    flex: 0,
                    width: crossCellWidth,
                    minWidth: crossCellWidth,
                    ...fiveCardSlotStyle(i),
                  };
                } else if (fourCardResult) {
                  slotColumnStyle = {
                    flex: 0,
                    width: "44%",
                    minWidth: "44%",
                  };
                } else if (threeCardLayout) {
                  slotColumnStyle = {
                    flex: 0,
                    width: slotCardWidth,
                    minWidth: slotCardWidth,
                  };
                } else {
                  slotColumnStyle = {
                    minWidth:
                      drawCount === 4 || drawCount === 2 ? "40%" : "30%",
                  };
                }

                return (
                  <View
                    key={pos.id}
                    style={[styles.slotCol, slotColumnStyle]}
                    testID={`three-card-slot-${i}`}
                  >
                    {!compactSlots ? (
                      <Text
                        style={[
                          styles.slotPositionLabel,
                          isNextPick && { color: theme.colors.gold },
                          !slotCard &&
                            flowPhase === "reveal" && { opacity: 0.45 },
                          denseResult && styles.slotPositionLabelDense,
                        ]}
                        numberOfLines={2}
                      >
                        {pos.labelRu}
                      </Text>
                    ) : null}
                    <View
                      ref={(node) => {
                        slotRefs.current[i] = node;
                      }}
                    >
                      <Animated.View
                        entering={FadeInDown.duration(380).springify()}
                      >
                        {flowPhase === "picking" && !slotCard && (
                          <View
                            style={[
                              styles.slotPlaceholder,
                              {
                                width: slotCardWidth,
                                height: slotCardHeight,
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
                            reversed={slotCard.reversed}
                            flipped={false}
                            width={slotCardWidth}
                            height={slotCardHeight}
                            hideFrontText
                          />
                        )}
                        {(flowPhase === "reveal" || flowPhase === "reading") &&
                          slotCard && (
                          <TarotCard
                            card={slotCard}
                            reversed={slotCard.reversed}
                            flipped={
                              flowPhase === "reading" ? true : revealedSlots[i]
                            }
                            width={slotCardWidth}
                            height={slotCardHeight}
                            hideFrontText
                            onPress={
                              flowPhase === "reading" || revealedSlots[i]
                                ? () => setPreviewCard(slotCard)
                                : undefined
                            }
                            testID={`reveal-slot-${i}`}
                          />
                        )}
                      </Animated.View>
                    </View>
                    <View
                      style={[
                        styles.slotCardTitleWrap,
                        !showCardNameBelow && styles.slotCardTitleWrapCollapsed,
                      ]}
                    >
                      {showCardNameBelow ? (
                        <Text
                          style={[
                            styles.slotCardTitleBelow,
                            denseResult && styles.slotCardTitleBelowDense,
                          ]}
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
                      reversed={slots[0].reversed}
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
              <GestureScrollView
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
                    <GestureDetector
                      key={c.id}
                      gesture={makeDeckCardDragGesture(c)}
                    >
                    <Pressable
                      ref={(node) => {
                        deckCardRefs.current[c.id] =
                          node as unknown as View | null;
                      }}
                      onPress={() => handlePickCard(c)}
                      testID={`tarot-card-slot-${idx}`}
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
                        reversed={c.reversed}
                        flipped={false}
                        width={fanCardW}
                        height={fanCardH}
                        hideFrontText={drawCount > 1}
                      />
                    </Pressable>
                    </GestureDetector>
                  );
                })}
              </GestureScrollView>
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
                card={slots[0] as OrientedTarotCard}
                reversed={(slots[0] as OrientedTarotCard).reversed}
                flipped={revealedSlots[0]}
                width={220}
                height={340}
                onPress={
                  revealedSlots[0]
                    ? () => setPreviewCard(slots[0] as OrientedTarotCard)
                    : undefined
                }
                testID="picked-card"
              />
            </Animated.View>
          )}

          {/* Reading block */}
          {flowPhase === "reading" && (
            <Animated.View entering={FadeIn.delay(200).duration(450)}>

              {drawCount === 1 && slots[0] && (
                <View style={styles.readingThumbWrap}>
                  <TarotCard
                    card={slots[0] as OrientedTarotCard}
                    reversed={(slots[0] as OrientedTarotCard).reversed}
                    flipped
                    width={132}
                    height={204}
                    onPress={() => setPreviewCard(slots[0] as OrientedTarotCard)}
                    testID="reading-card-thumb"
                  />
                  <Text
                    style={[
                      styles.slotCardTitleBelow,
                      styles.singleCardTitleBelow,
                    ]}
                    numberOfLines={2}
                  >
                    {(slots[0] as OrientedTarotCard).nameRu}
                  </Text>
                </View>
              )}

              <Pressable
                onPress={openTarotChat}
                disabled={!historyItemId}
                testID="tarot-ai-interpret"
                style={({ pressed }) => [
                  styles.aiCtaWrap,
                  pressed &&
                    historyItemId && {
                      opacity: 0.88,
                      transform: [{ scale: 0.98 }],
                    },
                  !historyItemId && { opacity: 0.55 },
                ]}
              >
                <LinearGradient
                  colors={
                    !chatStarted &&
                    !interpretQuota.unlimited &&
                    interpretQuota.remaining === 0
                      ? theme.gradients.primaryCtaMuted
                      : theme.gradients.primaryCta
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.aiCtaGradient}
                >
                  <View style={styles.aiCtaMain}>
                    <Text style={styles.aiCtaText}>
                      {chatStarted ? "Продолжить диалог" : "Истолковать"}
                    </Text>
                    <ArrowRight color="#FFF7EA" size={18} strokeWidth={1.2} />
                  </View>
                  {!chatStarted && !interpretQuota.unlimited ? (
                    <RemainPill remaining={interpretQuota.remaining} />
                  ) : null}
                </LinearGradient>
              </Pressable>

              <View style={styles.actionRow}>
                {viewingArchive ? null : (
                  <Pressable
                    onPress={resetSpread}
                    testID="tarot-reset-btn"
                    style={({ pressed }) => [
                      styles.actionCircleBtn,
                      styles.actionCircleBtnPrimary,
                      pressed && { transform: [{ scale: 0.94 }] },
                    ]}
                  >
                    <RefreshCw color="#05030D" size={22} strokeWidth={2.5} />
                  </Pressable>
                )}

                <Pressable
                  onPress={handleShareSpread}
                  disabled={sharing || shareSlots.length === 0}
                  testID="tarot-share-btn"
                  style={({ pressed }) => [
                    styles.actionCircleBtn,
                    pressed && { opacity: 0.7 },
                    (sharing || shareSlots.length === 0) && { opacity: 0.55 },
                  ]}
                >
                  {sharing ? (
                    <ActivityIndicator color={theme.colors.text} size="small" />
                  ) : (
                    <Share color={theme.colors.text} size={22} strokeWidth={2} />
                  )}
                </Pressable>

                <Pressable
                  onPress={() => {
                    setIntuitionText(savedIntuition);
                    setIntuitionJustSaved(false);
                    setIntuitionOpen(true);
                  }}
                  testID="intuition-open-btn"
                  style={({ pressed }) => [
                    styles.actionCircleBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  {intuitionSaved ? (
                    <Check color={theme.colors.gold} size={22} strokeWidth={2.5} />
                  ) : (
                    <PenTool color={theme.colors.text} size={22} strokeWidth={2} />
                  )}
                </Pressable>
              </View>

              {drawCount === 1 && slots[0] && (
                <GlassCard
                  glow="gold"
                  borderColor={theme.colors.borderGold}
                  style={styles.meaningCard}
                >
                  <View style={styles.meaningInner}>
                    <Text style={styles.cardName} testID="card-name">
                      {(slots[0] as OrientedTarotCard).nameRu}
                    </Text>
                    {(slots[0] as OrientedTarotCard).reversed ? (
                      <Text style={styles.reversedBadge}>Перевёрнутая</Text>
                    ) : null}
                    <View style={styles.divider} />
                    <Text style={styles.shortLabel}>Короткое значение</Text>
                    <Text style={styles.shortText} testID="card-short">
                      {cardShort(
                        slots[0] as OrientedTarotCard,
                        (slots[0] as OrientedTarotCard).reversed,
                      )}
                    </Text>
                    <View style={styles.dividerThin} />
                    <Text style={styles.shortLabel}>Подробное толкование</Text>
                    <Text style={styles.detailedText} testID="card-detailed">
                      {cardDetailed(
                        slots[0] as OrientedTarotCard,
                        (slots[0] as OrientedTarotCard).reversed,
                      )}
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
                        {card.reversed ? (
                          <Text style={styles.reversedBadge}>Перевёрнутая</Text>
                        ) : null}
                        <View style={styles.divider} />
                        <Text style={styles.shortLabel}>Короткое значение</Text>
                        <Text style={styles.shortText}>
                          {cardShort(card, card.reversed)}
                        </Text>
                        <View style={styles.dividerThin} />
                        <Text style={styles.shortLabel}>Подробное толкование</Text>
                        <Text style={styles.detailedText}>
                          {cardDetailed(card, card.reversed)}
                        </Text>
                      </View>
                    </GlassCard>
                  );
                })}

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
            </Animated.View>
          )}

          <View style={{ height: 140 }} />
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {flowPhase === "picking" && pickFlight ? (
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
            reversed={pickFlight.card.reversed}
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
        onRequestClose={closeIntuitionModal}
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
                    onPress={closeIntuitionModal}
                    testID="intuition-close-btn"
                  >
                    <X color={theme.colors.textDim} size={22} />
                  </Pressable>
                </View>

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
                    modalShowsSaved && styles.modalBtnSaved,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  {modalShowsSaved ? (
                    <Check color={theme.colors.text} size={16} strokeWidth={2.2} />
                  ) : null}
                  <Text style={styles.modalBtnText}>
                    {modalShowsSaved ? "Сохранено" : "Сохранить"}
                  </Text>
                </Pressable>
              </View>
            </GlassCard>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={previewCard != null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPreviewCard(null)}
      >
        <View style={styles.previewRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPreviewCard(null)}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          />
          {previewCard ? (
            <Animated.View
              entering={FadeInDown.duration(320).springify()}
              style={styles.previewSheet}
            >
              <Pressable
                onPress={() => setPreviewCard(null)}
                style={styles.previewClose}
                hitSlop={12}
                testID="card-preview-close"
              >
                <X color={theme.colors.textMuted} size={22} />
              </Pressable>
              <TarotCard
                card={previewCard}
                reversed={previewCard.reversed}
                flipped
                width={Math.min(260, width - 72)}
                height={Math.min(400, (width - 72) * (340 / 220))}
              />
              <Text style={styles.previewName} testID="card-preview-name">
                {previewCard.nameRu}
              </Text>
              {previewCard.reversed ? (
                <Text style={styles.reversedBadge}>Перевёрнутая</Text>
              ) : null}
              <Text style={styles.previewShort} testID="card-preview-short">
                {cardShort(previewCard, previewCard.reversed)}
              </Text>
            </Animated.View>
          ) : null}
        </View>
      </Modal>
      <ProModal visible={proVisible} onClose={() => setProVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg, position: "relative" },
  /** Embedded in Гадания: let the shell's tarot backdrop show through. */
  rootEmbedded: { backgroundColor: "transparent" },
  shareOffscreen: {
    position: "absolute",
    top: 0,
    left: -(SHARE_POSTER_W + 24),
    width: SHARE_POSTER_W,
    height: SHARE_POSTER_H,
    overflow: "hidden",
  },
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
  titleReading: {
    fontSize: 31,
    lineHeight: 37,
    marginBottom: 14,
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
    borderRadius: 30,
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
    color: theme.colors.archive.accent,
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
    flexWrap: "wrap",
    justifyContent: "space-evenly",
    alignItems: "flex-start",
    gap: 16,
    paddingHorizontal: 4,
    marginTop: 10,
    marginBottom: 2,
  },
  slotsRowCompact: {
    flexWrap: "nowrap",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 0,
  },
  slotsRowThree: {
    flexWrap: "nowrap",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 0,
  },
  slotsRowFourResult: {
    justifyContent: "center",
    columnGap: 12,
    rowGap: 12,
  },
  slotsRowFiveResult: {
    position: "relative",
    height: 438,
    flexWrap: "nowrap",
    paddingHorizontal: 0,
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
    height: 28,
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    textAlign: "center",
    width: "100%",
  },
  slotPositionLabelDense: {
    marginBottom: 5,
    height: 24,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.8,
  },
  slotCardTitleWrap: {
    marginTop: 8,
    minHeight: 42,
    width: "100%",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  slotCardTitleWrapCollapsed: {
    marginTop: 0,
    minHeight: 0,
  },
  slotCardTitleBelow: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 16,
    lineHeight: 20,
    textAlign: "center",
  },
  slotCardTitleBelowDense: {
    fontSize: 16,
    lineHeight: 19,
  },
  singleCardTitleBelow: {
    maxWidth: 280,
    marginTop: 10,
    fontSize: 18,
    lineHeight: 22,
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
    paddingVertical: 16,
    minHeight: MULTI_CARD_HEIGHT + 36,
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
  reversedBadge: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    textAlign: "center",
    marginTop: 6,
    opacity: 0.88,
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
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginTop: 20,
    paddingHorizontal: 20,
  },
  actionCircleBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionCircleBtnPrimary: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
    shadowColor: "#FFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
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
    marginBottom: 10,
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
    // @ts-ignore - web only
    outlineStyle: "none",
  },
  modalBtn: {
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: theme.colors.mauve,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  modalBtnSaved: {
    backgroundColor: "rgba(16,185,129,0.55)",
  },
  modalBtnText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  archiveEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  archiveEmptyTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    fontSize: 22,
    textAlign: "center",
  },
  archiveEmptyText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  aiCtaWrap: {
    marginTop: 20,
    borderRadius: 999,
    alignSelf: "stretch",
    ...theme.shadows.ctaPrimary,
  },
  aiCtaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 11,
    paddingLeft: 22,
    paddingRight: 12,
    borderRadius: 999,
  },
  aiCtaMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  aiCtaText: {
    color: "#FFF7EA",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: 0.5,
  },
  previewRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(8,6,18,0.82)",
    paddingHorizontal: 28,
  },
  previewSheet: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    backgroundColor: "rgba(24,21,43,0.96)",
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 22,
  },
  previewClose: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 2,
    padding: 4,
  },
  previewName: {
    marginTop: 20,
    color: theme.colors.gold,
    fontFamily: theme.fonts.display,
    fontSize: 24,
    textAlign: "center",
  },
  previewShort: {
    marginTop: 10,
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontStyle: "italic",
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
    opacity: 0.92,
  },
});
