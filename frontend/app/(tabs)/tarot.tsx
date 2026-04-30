import React, { useCallback, useMemo, useState } from "react";
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
import { Layers, PenTool, X, Sparkles } from "lucide-react-native";
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
import { TarotCardSnapshot, useHistory } from "../../src/context/HistoryContext";

type Phase = "spread" | "revealed";

function shuffleFan(count = 5): TarotCardType[] {
  const arr = [...TAROT_DECK];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

export default function TarotScreen() {
  const { addItem } = useHistory();
  const [spreadId, setSpreadId] = useState<TarotSpread["id"]>(DEFAULT_SPREAD_ID);
  const spread = useMemo(() => getSpreadById(spreadId), [spreadId]);

  const [intent, setIntent] = useState("");
  const [phase, setPhase] = useState<Phase>("spread");
  const [fan, setFan] = useState<TarotCardType[]>(() => shuffleFan(5));
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [slots, setSlots] = useState<(TarotCardType | null)[]>(() =>
    Array(spread.drawCount).fill(null),
  );

  const [intuitionOpen, setIntuitionOpen] = useState(false);
  const [intuitionText, setIntuitionText] = useState("");
  const [savedIntuition, setSavedIntuition] = useState<string>("");

  const drawCount = spread.drawCount;
  const nextSlotIndex = slots.findIndex((s) => s === null);
  const allPicked = nextSlotIndex === -1;

  const resetForSpread = useCallback(
    (nextSpread: TarotSpread) => {
      setFan(shuffleFan(5));
      setPickedIds([]);
      setSlots(Array(nextSpread.drawCount).fill(null));
      setPhase("spread");
      setIntuitionText("");
      setSavedIntuition("");
    },
    [],
  );

  const handleSelectSpread = (id: TarotSpread["id"]) => {
    if (id === spreadId) return;
    Haptics.selectionAsync().catch(() => {});
    const next = getSpreadById(id);
    setSpreadId(id);
    resetForSpread(next);
  };

  const commitHistory = (filledSlots: TarotCardType[]) => {
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
      question = trimmedIntent || "Одна карта";
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
    });
  };

  const handlePickCard = (card: TarotCardType) => {
    if (phase !== "spread") return;
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
      setPhase("revealed");
      commitHistory(nextSlots as TarotCardType[]);
    }
  };

  const reset = () => {
    Haptics.selectionAsync().catch(() => {});
    resetForSpread(spread);
  };

  const saveIntuition = () => {
    setSavedIntuition(intuitionText.trim());
    setIntuitionOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
  };

  const subtitle = useMemo(() => {
    if (phase === "revealed") {
      return drawCount === 1
        ? "Карта открыта. Прислушайся к её голосу."
        : "Расклад собран. Читай историю по порядку.";
    }
    const base =
      drawCount === 1
        ? "Сосредоточься и выбери карту"
        : `Вытяни ${drawCount} карты по очереди`;
    return intent.trim().length > 0 ? `${base} · ${intent.trim()}` : base;
  }, [phase, drawCount, intent]);

  const visibleFan = useMemo(
    () => fan.filter((c) => !pickedIds.includes(c.id)),
    [fan, pickedIds],
  );

  const intuitionModalSubtitle =
    drawCount === 1
      ? "Запиши свои первые мысли, прежде чем читать толкование."
      : "Запиши ощущения от всего расклада, прежде чем читать трактовку.";

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
          <Text style={styles.title}>{spread.titleRu}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* Spread picker */}
          <View style={styles.spreadPickerRow} testID="spread-picker">
            {TAROT_SPREADS.map((s) => {
              const active = s.id === spreadId;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => handleSelectSpread(s.id)}
                  testID={`spread-chip-${s.id}`}
                  style={({ pressed }) => [
                    styles.spreadChip,
                    active && styles.spreadChipActive,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Sparkles
                    color={active ? theme.colors.gold : theme.colors.textDim}
                    size={13}
                  />
                  <View style={{ flexShrink: 1 }}>
                    <Text
                      style={[
                        styles.spreadChipTitle,
                        active && { color: theme.colors.text },
                      ]}
                    >
                      {s.titleRu}
                    </Text>
                    <Text style={styles.spreadChipSubtitle} numberOfLines={1}>
                      {s.subtitleRu}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Optional intent input (only when still picking) */}
          {phase === "spread" && (
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
          )}

          {/* Three-card slots */}
          {drawCount > 1 && (
            <View style={styles.slotsRow}>
              {spread.positions.map((pos, i) => {
                const slotCard = slots[i];
                const isNext = i === nextSlotIndex;
                return (
                  <View
                    key={pos.id}
                    style={styles.slotCol}
                    testID={`three-card-slot-${i}`}
                  >
                    {slotCard ? (
                      <Animated.View
                        entering={FadeInDown.duration(450).springify()}
                        layout={Layout.springify()}
                      >
                        <TarotCard
                          card={slotCard}
                          flipped
                          width={92}
                          height={142}
                        />
                      </Animated.View>
                    ) : (
                      <View
                        style={[
                          styles.slotPlaceholder,
                          isNext && styles.slotPlaceholderActive,
                        ]}
                      >
                        <Text style={styles.slotPlaceholderIndex}>{i + 1}</Text>
                      </View>
                    )}
                    <Text
                      style={[
                        styles.slotLabel,
                        isNext && { color: theme.colors.gold },
                      ]}
                      numberOfLines={1}
                    >
                      {pos.labelRu}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Fan */}
          {phase === "spread" ? (
            <Animated.View
              entering={FadeIn.duration(400)}
              style={[
                styles.spreadWrap,
                drawCount > 1 && { paddingVertical: 30, minHeight: 220 },
              ]}
            >
              {visibleFan.map((c, idx) => {
                const center = (visibleFan.length - 1) / 2;
                const offset = idx - center;
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
                        zIndex: 5 - Math.abs(offset),
                        marginHorizontal: -22,
                      },
                    ]}
                  >
                    <TarotCard
                      card={c}
                      flipped={false}
                      width={drawCount > 1 ? 100 : 120}
                      height={drawCount > 1 ? 155 : 185}
                    />
                  </Pressable>
                );
              })}
            </Animated.View>
          ) : (
            // Revealed state
            drawCount === 1 && slots[0] && (
              <Animated.View
                entering={FadeInDown.duration(500).springify()}
                style={styles.pickedWrap}
              >
                <View style={styles.cardGlow} />
                <TarotCard
                  card={slots[0] as TarotCardType}
                  flipped
                  width={220}
                  height={340}
                  testID="picked-card"
                />
              </Animated.View>
            )
          )}

          {/* Interpretation block */}
          {phase === "revealed" && (
            <Animated.View entering={FadeIn.delay(300).duration(500)}>
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

              {savedIntuition.length > 0 && (
                <GlassCard
                  borderColor={theme.colors.borderPurple}
                  style={styles.intuitionSavedCard}
                >
                  <View style={{ padding: 18 }}>
                    <Text style={styles.intuitionEyebrow}>МОЁ ТОЛКОВАНИЕ</Text>
                    <Text style={styles.intuitionSavedText}>
                      {savedIntuition}
                    </Text>
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
                onPress={reset}
                testID="tarot-reset-btn"
                style={({ pressed }) => [
                  styles.resetBtn,
                  pressed && { transform: [{ scale: 0.98 }] },
                ]}
              >
                <Layers color="#0D0E15" size={16} />
                <Text style={styles.resetBtnText}>Новый расклад</Text>
              </Pressable>
            </Animated.View>
          )}

          <View style={{ height: 140 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Intuition Modal */}
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
                <Text style={styles.modalSubtitle}>
                  {intuitionModalSubtitle}
                </Text>
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
    color: theme.colors.textDim,
    marginTop: 8,
  },
  title: {
    fontFamily: theme.fonts.headingBold,
    color: theme.colors.text,
    fontSize: 30,
    marginTop: 4,
  },
  subtitle: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    marginTop: 6,
    marginBottom: 16,
  },
  spreadPickerRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  spreadChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  spreadChipActive: {
    borderColor: theme.colors.borderGold,
    backgroundColor: "rgba(212,175,55,0.12)",
  },
  spreadChipTitle: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  spreadChipSubtitle: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 10,
    marginTop: 2,
    opacity: 0.85,
  },
  intentWrap: {
    marginBottom: 8,
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
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  slotsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 18,
    marginBottom: 6,
  },
  slotCol: {
    flex: 1,
    alignItems: "center",
  },
  slotPlaceholder: {
    width: 92,
    height: 142,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: theme.colors.border,
    backgroundColor: "rgba(255,255,255,0.02)",
    alignItems: "center",
    justifyContent: "center",
  },
  slotPlaceholderActive: {
    borderColor: theme.colors.borderGold,
    backgroundColor: "rgba(212,175,55,0.06)",
  },
  slotPlaceholderIndex: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.headingBold,
    fontSize: 28,
    opacity: 0.5,
  },
  slotLabel: {
    marginTop: 8,
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  spreadWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    minHeight: 260,
  },
  spreadCardWrap: {
    shadowColor: theme.colors.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  pickedWrap: {
    alignItems: "center",
    justifyContent: "center",
    height: 360,
    marginVertical: 16,
  },
  cardGlow: {
    position: "absolute",
    width: 280,
    height: 380,
    borderRadius: 200,
    backgroundColor: "rgba(212,175,55,0.12)",
    shadowColor: theme.colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 50,
  },
  meaningCard: {
    marginTop: 12,
  },
  meaningInner: { padding: 22 },
  positionEyebrow: {
    color: theme.colors.purple,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 2.2,
    textAlign: "center",
    marginBottom: 8,
  },
  cardName: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.headingBold,
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
    backgroundColor: "rgba(212,175,55,0.5)",
    marginVertical: 16,
  },
  dividerThin: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 16,
  },
  shortLabel: {
    color: theme.colors.purple,
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
    backgroundColor: "rgba(157,78,221,0.1)",
    marginTop: 16,
  },
  intuitionBtnText: {
    color: theme.colors.purple,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
    letterSpacing: 1,
  },
  intuitionSavedCard: {
    marginTop: 12,
  },
  intuitionEyebrow: {
    color: theme.colors.purple,
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
    backgroundColor: theme.colors.gold,
    marginTop: 16,
  },
  resetBtnText: {
    color: "#0D0E15",
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
    backgroundColor: "rgba(0,0,0,0.7)",
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
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  modalBtn: {
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: theme.colors.gold,
    alignItems: "center",
  },
  modalBtnText: {
    color: "#0D0E15",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
});
