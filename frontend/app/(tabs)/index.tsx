import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Flame, Droplets, Sparkles } from "lucide-react-native";
import { theme } from "../../src/theme";
import CosmicBackground from "../../src/components/CosmicBackground";
import GlassCard from "../../src/components/GlassCard";
import TarotCard from "../../src/components/TarotCard";
import {
  DAILY_PHRASES,
  DAILY_SIGNS,
  TAROT_DECK,
} from "../../src/data/tarotCards";
import { useHistory } from "../../src/context/HistoryContext";

function pickByDay<T>(arr: T[]): T {
  const day = new Date();
  const idx =
    (day.getFullYear() * 372 + day.getMonth() * 31 + day.getDate()) %
    arr.length;
  return arr[idx];
}

export default function HomeScreen() {
  const { streak, addItem, items } = useHistory();
  const [flipped, setFlipped] = useState(false);

  const dailyPhrase = useMemo(() => pickByDay(DAILY_PHRASES), []);
  const dailySign = useMemo(() => pickByDay(DAILY_SIGNS), []);
  const cardOfTheDay = useMemo(() => pickByDay(TAROT_DECK), []);

  // Has the user already saved this card today?
  const todayCardSaved = useMemo(() => {
    const today = new Date();
    return items.some(
      (it) =>
        it.type === "tarot" &&
        it.cardId === cardOfTheDay.id &&
        new Date(it.date).toDateString() === today.toDateString() &&
        it.question === "Карта дня",
    );
  }, [items, cardOfTheDay.id]);

  const handleFlip = () => {
    if (flipped) return;
    setFlipped(true);
    if (!todayCardSaved) {
      addItem({
        type: "tarot",
        question: "Карта дня",
        answer: `${cardOfTheDay.nameRu} — ${cardOfTheDay.short}`,
        cardId: cardOfTheDay.id,
        cardName: cardOfTheDay.nameRu,
      });
    }
  };

  return (
    <View style={styles.root}>
      <CosmicBackground />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          testID="home-scroll"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>СЕГОДНЯ</Text>
              <Text style={styles.headerTitle} testID="home-greeting">
                Звёзды благосклонны
              </Text>
            </View>
            <View style={styles.streakBadge} testID="streak-badge">
              <Flame color={theme.colors.gold} size={16} />
              <Text style={styles.streakText}>{streak} дн.</Text>
            </View>
          </View>

          {/* Energy of the Day */}
          <GlassCard
            glow="purple"
            borderColor={theme.colors.borderPurple}
            style={styles.energyCard}
          >
            <View style={styles.energyInner}>
              <View style={styles.energyHeader}>
                <Sparkles color={theme.colors.purple} size={18} />
                <Text style={styles.energyEyebrow}>Энергия дня</Text>
              </View>
              <Text style={styles.energyPhrase} testID="energy-phrase">
                «{dailyPhrase}»
              </Text>
            </View>
          </GlassCard>

          {/* Card of the Day */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Карта дня</Text>
            <Text style={styles.sectionSubtitle}>
              Прикоснись, чтобы открыть послание
            </Text>
          </View>
          <View style={styles.cardWrapper}>
            <View style={styles.cardGlow} />
            <TarotCard
              card={cardOfTheDay}
              flipped={flipped}
              onFlip={handleFlip}
              width={240}
              height={380}
              testID="card-of-the-day"
            />
          </View>

          {flipped && (
            <GlassCard
              glow="gold"
              borderColor={theme.colors.borderGold}
              style={styles.cardMessage}
            >
              <View style={styles.cardMessageInner}>
                <Text style={styles.cardName} testID="card-of-the-day-name">
                  {cardOfTheDay.nameRu}
                </Text>
                <View style={styles.divider} />
                <Text style={styles.cardAdvice}>{cardOfTheDay.short}</Text>
              </View>
            </GlassCard>
          )}

          {/* Sign of the Day */}
          <GlassCard
            borderColor={theme.colors.border}
            style={styles.signCard}
          >
            <View style={styles.signInner}>
              <View style={styles.signIcon}>
                <Droplets color={theme.colors.purple} size={18} />
              </View>
              <Text style={styles.signText} testID="sign-of-day">
                {dailySign}
              </Text>
            </View>
          </GlassCard>

          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    marginTop: 8,
  },
  eyebrow: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 3,
    color: theme.colors.textDim,
    marginBottom: 6,
  },
  headerTitle: {
    fontFamily: theme.fonts.headingBold,
    color: theme.colors.text,
    fontSize: 30,
    lineHeight: 34,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.4)",
  },
  streakText: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
  },
  energyCard: {
    marginBottom: 28,
  },
  energyInner: { padding: 20 },
  energyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  energyEyebrow: {
    color: theme.colors.purple,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 2,
  },
  energyPhrase: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 22,
    lineHeight: 30,
    fontStyle: "italic",
  },
  section: {
    marginBottom: 16,
    marginTop: 4,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.headingBold,
    fontSize: 24,
  },
  sectionSubtitle: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  cardWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
    height: 400,
  },
  cardGlow: {
    position: "absolute",
    width: 280,
    height: 380,
    borderRadius: 200,
    backgroundColor: "rgba(157,78,221,0.18)",
    shadowColor: theme.colors.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 60,
  },
  cardMessage: {
    marginTop: 8,
    marginBottom: 24,
  },
  cardMessageInner: { padding: 20 },
  cardName: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.headingBold,
    fontSize: 22,
    textAlign: "center",
  },
  divider: {
    height: 1,
    width: 40,
    alignSelf: "center",
    backgroundColor: "rgba(212,175,55,0.5)",
    marginVertical: 12,
  },
  cardAdvice: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    fontStyle: "italic",
  },
  signCard: {
    marginTop: 4,
  },
  signInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  signIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(157,78,221,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(157,78,221,0.35)",
  },
  signText: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 14,
  },
});
