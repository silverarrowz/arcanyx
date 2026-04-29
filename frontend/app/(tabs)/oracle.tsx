import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
  withSequence,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Eye, Sparkles } from "lucide-react-native";
import { theme } from "../../src/theme";
import CosmicBackground from "../../src/components/CosmicBackground";
import GlassCard from "../../src/components/GlassCard";
import {
  CATEGORY_META,
  getRandomOracleAnswer,
  OracleCategory,
} from "../../src/data/oracleAnswers";
import { useHistory } from "../../src/context/HistoryContext";

type Phase = "idle" | "loading" | "result";

export default function OracleScreen() {
  const { addItem } = useHistory();
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<{
    category: OracleCategory;
    answer: string;
  } | null>(null);

  // breathing
  const breathing = useSharedValue(1);
  // pulse during loading
  const pulse = useSharedValue(0);

  useEffect(() => {
    breathing.value = withRepeat(
      withTiming(1.08, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(breathing);
  }, [breathing]);

  useEffect(() => {
    if (phase === "loading") {
      pulse.value = withRepeat(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [phase, pulse]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathing.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.5,
    transform: [{ scale: 1 + pulse.value * 0.15 }],
  }));

  const askUniverse = () => {
    if (phase === "loading") return;
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setPhase("loading");
    setResult(null);
    // small wobble
    breathing.value = withSequence(
      withTiming(0.95, { duration: 120 }),
      withTiming(1.12, { duration: 180 }),
      withTiming(1, { duration: 200 }),
    );
    setTimeout(() => {
      const r = getRandomOracleAnswer();
      setResult(r);
      setPhase("result");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      const trimmed = question.trim() || "Без вопроса";
      addItem({
        type: "oracle",
        question: trimmed,
        answer: r.answer,
        category: r.category,
        outcome: null,
      });
    }, 2000);
  };

  const reset = () => {
    setPhase("idle");
    setResult(null);
    setQuestion("");
  };

  const meta = result ? CATEGORY_META[result.category] : null;

  return (
    <View style={styles.root}>
      <CosmicBackground />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.eyebrow}>ОРАКУЛ</Text>
              <Text style={styles.title}>Спроси Вселенную</Text>

              <GlassCard style={styles.inputCard}>
                <View style={styles.inputInner}>
                  <Eye color={theme.colors.purple} size={18} />
                  <TextInput
                    testID="oracle-input"
                    value={question}
                    onChangeText={setQuestion}
                    placeholder="Задай вопрос Вселенной..."
                    placeholderTextColor={theme.colors.textDim}
                    style={styles.input}
                    multiline
                    editable={phase !== "loading"}
                  />
                </View>
              </GlassCard>

              {/* Orb */}
              <View style={styles.orbWrap}>
                <Animated.View style={[styles.orbHalo, haloStyle]} />
                <Animated.View style={[styles.orbContainer, orbStyle]}>
                  <View style={styles.orbOuter}>
                    <View style={styles.orbInner}>
                      {phase === "loading" ? (
                        <Text style={styles.orbLoading}>...</Text>
                      ) : phase === "result" && result ? (
                        <View style={{ alignItems: "center" }}>
                          <Sparkles color={theme.colors.gold} size={28} />
                        </View>
                      ) : (
                        <Sparkles color={theme.colors.gold} size={32} />
                      )}
                    </View>
                  </View>
                </Animated.View>
              </View>

              {phase === "result" && result && meta && (
                <GlassCard
                  glow="gold"
                  borderColor={theme.colors.borderGold}
                  style={styles.resultCard}
                >
                  <View style={styles.resultInner}>
                    <View
                      style={[
                        styles.categoryBadge,
                        { borderColor: meta.color, backgroundColor: meta.color + "22" },
                      ]}
                    >
                      <Text style={[styles.categoryText, { color: meta.color }]}>
                        {meta.label.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.resultText} testID="oracle-answer">
                      «{result.answer}»
                    </Text>
                    <Text style={styles.resultSub}>
                      Сохранено в Дневник Судьбы
                    </Text>
                  </View>
                </GlassCard>
              )}

              <Pressable
                onPress={phase === "result" ? reset : askUniverse}
                disabled={phase === "loading"}
                testID="oracle-ask-btn"
                style={({ pressed }) => [
                  styles.askButton,
                  phase === "loading" && { opacity: 0.6 },
                  pressed && { transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text style={styles.askButtonText}>
                  {phase === "loading"
                    ? "Слушаю Вселенную…"
                    : phase === "result"
                    ? "Задать новый вопрос"
                    : "Узнать ответ"}
                </Text>
              </Pressable>

              <View style={{ height: 140 }} />
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
    marginBottom: 6,
    marginTop: 8,
  },
  title: {
    fontFamily: theme.fonts.headingBold,
    color: theme.colors.text,
    fontSize: 30,
    marginBottom: 20,
  },
  inputCard: {
    marginBottom: 24,
  },
  inputInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 15,
    minHeight: 24,
    maxHeight: 100,
    paddingTop: 0,
  },
  orbWrap: {
    height: 280,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
  orbHalo: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(157,78,221,0.25)",
    shadowColor: theme.colors.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 60,
  },
  orbContainer: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  orbOuter: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(157,78,221,0.18)",
    borderWidth: 1,
    borderColor: "rgba(157,78,221,0.5)",
    shadowColor: theme.colors.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
  },
  orbInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(13,14,21,0.6)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.4)",
  },
  orbLoading: {
    color: theme.colors.gold,
    fontSize: 32,
    fontFamily: theme.fonts.headingBold,
    letterSpacing: 4,
  },
  resultCard: {
    marginTop: 8,
    marginBottom: 20,
  },
  resultInner: {
    padding: 20,
    alignItems: "center",
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 999,
    marginBottom: 12,
  },
  categoryText: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 2,
  },
  resultText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 22,
    lineHeight: 30,
    fontStyle: "italic",
    textAlign: "center",
  },
  resultSub: {
    color: theme.colors.textDim,
    fontSize: 11,
    fontFamily: theme.fonts.body,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 12,
  },
  askButton: {
    backgroundColor: theme.colors.gold,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    shadowColor: theme.colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
    marginTop: 8,
  },
  askButtonText: {
    color: "#0D0E15",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 15,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
});
