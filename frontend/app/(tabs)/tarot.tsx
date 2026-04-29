import React, { useMemo, useState } from "react";
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
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Layers, PenTool, X } from "lucide-react-native";
import { theme } from "../../src/theme";
import CosmicBackground from "../../src/components/CosmicBackground";
import GlassCard from "../../src/components/GlassCard";
import TarotCard from "../../src/components/TarotCard";
import { TAROT_DECK, TarotCard as TarotCardType } from "../../src/data/tarotCards";
import { useHistory } from "../../src/context/HistoryContext";

type Phase = "spread" | "revealed";

function shuffleSpread(): TarotCardType[] {
  const arr = [...TAROT_DECK];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, 5);
}

export default function TarotScreen() {
  const { addItem } = useHistory();
  const [phase, setPhase] = useState<Phase>("spread");
  const [spread, setSpread] = useState<TarotCardType[]>(() => shuffleSpread());
  const [picked, setPicked] = useState<TarotCardType | null>(null);
  const [intuitionOpen, setIntuitionOpen] = useState(false);
  const [intuitionText, setIntuitionText] = useState("");
  const [savedIntuition, setSavedIntuition] = useState<string>("");

  const handlePickCard = (card: TarotCardType) => {
    if (phase !== "spread") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setPicked(card);
    setPhase("revealed");
    addItem({
      type: "tarot",
      question: "Расклад на одну карту",
      answer: `${card.nameRu} — ${card.short}`,
      cardId: card.id,
      cardName: card.nameRu,
    });
  };

  const reset = () => {
    setSpread(shuffleSpread());
    setPicked(null);
    setPhase("spread");
    setIntuitionText("");
    setSavedIntuition("");
  };

  const saveIntuition = () => {
    setSavedIntuition(intuitionText.trim());
    setIntuitionOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
  };

  const cards = useMemo(() => spread, [spread]);

  return (
    <View style={styles.root}>
      <CosmicBackground />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eyebrow}>ТАРО</Text>
          <Text style={styles.title}>Один расклад</Text>
          <Text style={styles.subtitle}>
            {phase === "spread"
              ? "Сосредоточься на ситуации и выбери карту"
              : "Карта открыта. Прислушайся к её голосу."}
          </Text>

          {phase === "spread" ? (
            <Animated.View
              entering={FadeIn.duration(400)}
              style={styles.spreadWrap}
            >
              {cards.map((c, idx) => (
                <Pressable
                  key={c.id}
                  onPress={() => handlePickCard(c)}
                  testID={`tarot-card-slot-${idx}`}
                  style={[
                    styles.spreadCardWrap,
                    {
                      transform: [
                        { rotate: `${(idx - 2) * 7}deg` },
                        { translateY: Math.abs(idx - 2) * 8 },
                      ],
                      zIndex: 5 - Math.abs(idx - 2),
                      marginHorizontal: -22,
                    },
                  ]}
                >
                  <TarotCard
                    card={c}
                    flipped={false}
                    width={120}
                    height={185}
                  />
                </Pressable>
              ))}
            </Animated.View>
          ) : (
            picked && (
              <Animated.View
                entering={FadeInDown.duration(500).springify()}
                style={styles.pickedWrap}
              >
                <View style={styles.cardGlow} />
                <TarotCard
                  card={picked}
                  flipped
                  width={220}
                  height={340}
                  testID="picked-card"
                />
              </Animated.View>
            )
          )}

          {phase === "revealed" && picked && (
            <Animated.View entering={FadeIn.delay(400).duration(500)}>
              <GlassCard
                glow="gold"
                borderColor={theme.colors.borderGold}
                style={styles.meaningCard}
              >
                <View style={styles.meaningInner}>
                  <Text style={styles.cardName} testID="card-name">
                    {picked.nameRu}
                  </Text>
                  <Text style={styles.cardLatin}>{picked.name}</Text>
                  <View style={styles.divider} />
                  <Text style={styles.shortLabel}>Короткое значение</Text>
                  <Text style={styles.shortText} testID="card-short">
                    {picked.short}
                  </Text>
                  <View style={styles.dividerThin} />
                  <Text style={styles.shortLabel}>Подробное толкование</Text>
                  <Text style={styles.detailedText} testID="card-detailed">
                    {picked.detailed}
                  </Text>
                </View>
              </GlassCard>

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
                  Запиши свои первые мысли, прежде чем читать толкование.
                </Text>
                <TextInput
                  testID="intuition-input"
                  value={intuitionText}
                  onChangeText={setIntuitionText}
                  placeholder="Что я чувствую, глядя на эту карту?"
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
    marginBottom: 24,
  },
  spreadWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    minHeight: 280,
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
    marginTop: 8,
  },
  meaningInner: { padding: 22 },
  cardName: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.headingBold,
    fontSize: 28,
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
