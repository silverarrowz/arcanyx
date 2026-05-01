import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Layout,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  Layers,
  PenTool,
  X,
  Sparkles,
  ArrowLeft,
} from "lucide-react-native";
import { theme } from "../../src/theme";
import CosmicBackground from "../../src/components/CosmicBackground";
import GlassCard from "../../src/components/GlassCard";
import TarotCard from "../../src/components/TarotCard";
import { TAROT_DECK, TarotCard as TarotCardType } from "../../src/data/tarotCards";
import {
  DEFAULT_SPREAD_ID,
  TAROT_SPREADS,
  TarotSpread,
  getSpreadById,
} from "../../src/data/tarotSpreads";
import { buildTarotSummaryRu } from "../../src/data/tarotReadingSummary";
import { TarotCardSnapshot, useHistory } from "../../src/context/HistoryContext";

type FlowPhase = "select" | "focus" | "picking" | "reveal" | "reading";

function shuffleFan(count = 5): TarotCardType[] {
  const arr = [...TAROT_DECK];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

/** Larger cards + layout tweaks for 3-card spreads */
const MULTI_CARD_WIDTH = 118;
const MULTI_CARD_HEIGHT = 182;
export default function TarotScreen() {
  const { addItem } = useHistory();
  const revealTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [spreadId, setSpreadId] = useState<TarotSpread["id"]>(DEFAULT_SPREAD_ID);
  const spread = useMemo(() => getSpreadById(spreadId), [spreadId]);

  const [flowPhase, setFlowPhase] = useState<FlowPhase>("select");
  const [intent, setIntent] = useState("");
  const [readingSummaryRu, setReadingSummaryRu] = useState<string | null>(
    null,
  );

  const [fan, setFan] = useState<TarotCardType[]>(() => shuffleFan(5));
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
      setFan(shuffleFan(5));
      setPickedIds([]);
      setSlots(Array(s.drawCount).fill(null));
      setRevealedSlots(Array(s.drawCount).fill(false));
      setFlowPhase("select");
      setIntent("");
      setIntuitionText("");
      setSavedIntuition("");
      setReadingSummaryRu(null);
    },
    [clearRevealTimers],
  );

  /** Change spread during selection step only (resizes slots etc.). */
  const handleSelectSpread = (id: TarotSpread["id"]) => {
    if (flowPhase !== "select") return;
    Haptics.selectionAsync().catch(() => {});
    const next = getSpreadById(id);
    setSpreadId(id);
    setSlots(Array(next.drawCount).fill(null));
    setPickedIds([]);
    setRevealedSlots(Array(next.drawCount).fill(false));
    setReadingSummaryRu(null);
  };

  const goToFocus = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFlowPhase("focus");
    setReadingSummaryRu(null);
  };

  const goBackToSelect = () => {
    Haptics.selectionAsync().catch(() => {});
    setFlowPhase("select");
  };

  const shuffleDeck = () => {
    clearRevealTimers();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    setFan(shuffleFan(5));
    setPickedIds([]);
    setSlots(Array(spread.drawCount).fill(null));
    setRevealedSlots(Array(spread.drawCount).fill(false));
    setReadingSummaryRu(null);
    setFlowPhase("picking");
  };

  const commitHistory = useCallback(
    (filledSlots: TarotCardType[], summaryRu: string) => {
      const trimmedIntent = intent.trim();
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
        question = trimmedIntent || spread.titleRu;
        answer = `${c.nameRu} — ${c.short}`;
      } else {
        question = trimmedIntent || spread.titleRu;
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
        intent: trimmedIntent || undefined,
        cardsSnapshot: snapshot,
        tarotSummaryRu: summaryRu,
      });
    },
    [addItem, spread, intent, drawCount],
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
        const summary = buildTarotSummaryRu(spread, filledSlots, intent);
        setReadingSummaryRu(summary);
        commitHistory(filledSlots, summary);
        setFlowPhase("reading");
      }, revealStartDelayMs + filledSlots.length * revealStepMs + 520);
      revealTimeoutsRef.current.push(finishTimerId);
    },
    [clearRevealTimers, commitHistory, drawCount, intent, spread],
  );

  const handlePickCard = (card: TarotCardType) => {
    if (flowPhase !== "picking") return;
    if (pickedIds.includes(card.id)) return;
    if (allPicked) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    const idx = slots.findIndex((s) => s === null);
    if (idx === -1) return;

    const nextSlots = [...slots];
    nextSlots[idx] = card;
    const nextPickedIds = [...pickedIds, card.id];

    setSlots(nextSlots);
    setPickedIds(nextPickedIds);

    const filledCount = nextSlots.filter(Boolean).length;
    if (filledCount === drawCount) {
      startAutoReveal(nextSlots as TarotCardType[]);
    }
  };

  const resetSpread = () => {
    clearRevealTimers();
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
        return "Выбери расклад и опционально добавь тему ниже.";
      case "focus":
        return `Расклад: ${spread.titleRu}`;
      case "picking":
        return `Выбрано ${pickedIds.length} из ${drawCount}`;
      case "reveal":
        return "";
      case "reading":
        return "";
      default:
        return "";
    }
  }, [flowPhase, spread.titleRu, pickedIds.length, drawCount]);

  const visibleFan = useMemo(
    () => fan.filter((c) => !pickedIds.includes(c.id)),
    [fan, pickedIds],
  );

  const intuitionModalSubtitle =
    drawCount === 1
      ? "Запиши свои первые мысли, прежде чем читать толкование."
      : "Запиши ощущения от всего расклада, прежде чем читать трактовку.";

  const pickingOrRevealOrReading =
    flowPhase === "picking" ||
    flowPhase === "reveal" ||
    flowPhase === "reading";

  return (
    <View style={styles.root}>
      <CosmicBackground />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.eyebrow}>ТАРО</Text>
          <Text style={styles.title}>
            {flowPhase === "select" ? "Таро" : spread.titleRu}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          {/* ——— Select spread ——— */}
          {flowPhase === "select" && (
            <Animated.View entering={FadeIn.duration(380)}>
              <View style={styles.spreadPickerCol} testID="spread-picker">
                {TAROT_SPREADS.map((s) => {
                  const active = s.id === spreadId;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => handleSelectSpread(s.id)}
                      testID={`spread-chip-${s.id}`}
                      style={({ pressed }) => [
                        styles.spreadOption,
                        active && styles.spreadOptionActive,
                        pressed && { opacity: 0.9 },
                      ]}
                    >
                      <Sparkles
                        color={active ? theme.colors.gold : theme.colors.textDim}
                        size={16}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.spreadOptionTitle,
                            active && { color: theme.colors.text },
                          ]}
                          numberOfLines={2}
                        >
                          {s.titleRu}
                        </Text>
                        <Text style={styles.spreadOptionSubtitle} numberOfLines={2}>
                          {s.subtitleRu}
                        </Text>
                      </View>
                      <Text style={styles.spreadOptionBadge}>
                        {s.drawCount === 1 ? "1 карта" : `${s.drawCount} карты`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.intentWrap}>
                <Text style={styles.intentLabel}>О чём сейчас? (необязательно)</Text>
                <TextInput
                  testID="tarot-intent-input"
                  value={intent}
                  onChangeText={setIntent}
                  placeholder="Например: отношения, работа, путь…"
                  placeholderTextColor={theme.colors.textDim}
                  style={styles.intentInput}
                  maxLength={140}
                />
              </View>

              <Pressable
                onPress={goToFocus}
                testID="tarot-continue-btn"
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && { transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text style={styles.primaryBtnText}>Дальше</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* ——— Focus / shuffle ——— */}
          {flowPhase === "focus" && (
            <Animated.View entering={FadeInDown.duration(400)}>
              <GlassCard glow="purple" borderColor={theme.colors.borderPurple}>
                <View style={styles.focusInner}>
                  <Text style={styles.focusBody}>
                    Сделай вдох. Сформулируй вопрос. Когда будешь готова —
                    перемешай колоду: так карты принимают твою энергию.
                  </Text>
                  {intent.trim().length > 0 ? (
                    <Text style={styles.focusIntent}>«{intent.trim()}»</Text>
                  ) : null}

                  <Pressable
                    onPress={shuffleDeck}
                    testID="tarot-shuffle-btn"
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      { marginTop: 18 },
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Sparkles color={theme.colors.text} size={18} />
                    <Text style={styles.primaryBtnText}>Перемешать колоду</Text>
                  </Pressable>

                  <Pressable
                    onPress={goBackToSelect}
                    style={styles.textLinkRow}
                    testID="tarot-back-select"
                  >
                    <ArrowLeft color={theme.colors.textDim} size={16} />
                    <Text style={styles.textLink}>Изменить расклад</Text>
                  </Pressable>
                </View>
              </GlassCard>
            </Animated.View>
          )}

          {/* Optional intent recap while picking */}
          {flowPhase === "picking" && intent.trim().length > 0 && (
            <Text style={styles.intentHint} numberOfLines={2}>
              Тема: {intent.trim()}
            </Text>
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

          {/* Fan */}
          {flowPhase === "picking" && (
            <Animated.View
              entering={FadeIn.duration(400)}
              style={[
                styles.spreadWrap,
                drawCount > 1 && {
                  paddingVertical: 28,
                  minHeight: MULTI_CARD_HEIGHT + 44,
                },
              ]}
            >
              {visibleFan.map((c, idx) => {
                const center = (visibleFan.length - 1) / 2;
                const offset = idx - center;
                const stackZIndex = Math.max(
                  1,
                  50 - Math.round(Math.abs(offset) * 10),
                );
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => handlePickCard(c)}
                    testID={`tarot-card-slot-${idx}`}
                    style={[
                      styles.spreadCardWrap,
                      {
                        transform: [
                          { rotate: `${offset * 7}deg` },
                          { translateY: Math.abs(offset) * 8 },
                        ],
                        zIndex: stackZIndex,
                        marginHorizontal: drawCount > 1 ? -14 : -22,
                      },
                    ]}
                  >
                    <TarotCard
                      card={c}
                      flipped={false}
                      width={drawCount > 1 ? MULTI_CARD_WIDTH : 120}
                      height={drawCount > 1 ? MULTI_CARD_HEIGHT : 185}
                      hideFrontText={drawCount > 1}
                    />
                  </Pressable>
                );
              })}
            </Animated.View>
          )}

          {flowPhase === "picking" && drawCount === 1 && (
            <Text style={styles.hintMuted}>
              Коснись карты во веере — открой свою выпавшую.
            </Text>
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

          {flowPhase === "picking" && (
            <Pressable
              onPress={goBackToSelect}
              style={[styles.textLinkRow, { marginTop: 8 }]}
            >
              <ArrowLeft color={theme.colors.textDim} size={16} />
              <Text style={styles.textLink}>Начать заново</Text>
            </Pressable>
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
      </SafeAreaView>

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
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 8 },
  eyebrow: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 3,
    color: theme.colors.gold,
    marginTop: 8,
  },
  title: {
    fontFamily: theme.fonts.display,
    color: theme.colors.text,
    fontSize: 37,
    marginTop: 6,
    lineHeight: 44,
  },
  subtitle: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    marginTop: 6,
    marginBottom: 14,
    lineHeight: 20,
  },
  spreadPickerCol: {
    gap: 10,
    marginBottom: 14,
  },
  spreadOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceGlass,
  },
  spreadOptionActive: {
    borderColor: theme.colors.borderGold,
    backgroundColor: theme.colors.purpleSoft,
  },
  spreadOptionTitle: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 15,
  },
  spreadOptionSubtitle: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    marginTop: 4,
    opacity: 0.88,
  },
  spreadOptionBadge: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 1,
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
  focusInner: { padding: 20 },
  focusBody: {
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  focusIntent: {
    marginTop: 12,
    color: theme.colors.gold,
    fontFamily: theme.fonts.heading,
    fontSize: 16,
    fontStyle: "italic",
    lineHeight: 22,
  },
  intentWrap: { marginBottom: 8 },
  intentHint: {
    color: theme.colors.textDim,
    fontSize: 12,
    marginBottom: 8,
    fontFamily: theme.fonts.body,
  },
  intentLabel: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  intentInput: {
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    backgroundColor: theme.colors.surfaceGlass,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderPurple,
  },
  textLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
  },
  textLink: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
  },
  hintMuted: {
    textAlign: "center",
    color: theme.colors.textDim,
    fontSize: 12,
    marginTop: 4,
    fontFamily: theme.fonts.body,
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
  spreadWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    minHeight: 260,
  },
  spreadCardWrap: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
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
