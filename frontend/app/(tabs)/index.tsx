import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bell,
  ChevronRight,
  Compass,
  Feather,
  Flame,
  Flower2,
  Menu,
  Moon,
  Sparkles,
  Sun,
} from "lucide-react-native";
import { theme } from "../../src/theme";
import CosmicBackground from "../../src/components/CosmicBackground";
import GlassCard from "../../src/components/GlassCard";
import TarotCard from "../../src/components/TarotCard";
import {
  DAILY_PHRASES,
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

function greetingForHour(h: number): string {
  if (h >= 5 && h < 12) return "Доброе утро";
  if (h >= 12 && h < 17) return "Добрый день";
  if (h >= 17 && h < 23) return "Добрый вечер";
  return "Доброй ночи";
}

const ENERGY_THEMES = [
  {
    title: "Расширение\nи Рост",
    quote: "То, что ты взращиваешь сегодня, расцветёт твоим завтра.",
  },
  {
    title: "Ясность\nи Фокус",
    quote: "Тишина внутри — лучший компас для внешнего пути.",
  },
  {
    title: "Принятие\nи Поток",
    quote: "Когда ты перестаёшь бороться, вселенная начинает вести.",
  },
  {
    title: "Любовь\nи Мягкость",
    quote: "Нежность к себе — это магия, которую ты несёшь в мир.",
  },
  {
    title: "Сила\nи Смелость",
    quote: "Каждый шаг в неизвестность — это шаг к самой себе.",
  },
];

type Ritual = {
  key: string;
  title: string;
  subtitle: string;
  Icon: React.ComponentType<{ color: string; size: number; strokeWidth?: number }>;
  gradient: [string, string];
  tint: string;
};

const QUICK_RITUALS: Ritual[] = [
  {
    key: "oracle",
    title: "Спроси\nОракула",
    subtitle: "Магический шар",
    Icon: Sparkles,
    gradient: ["rgba(157,124,230,0.38)", "rgba(196,123,234,0.18)"],
    tint: "#C47BEA",
  },
  {
    key: "dream",
    title: "Толковать\nсон",
    subtitle: "Найди ясность",
    Icon: Moon,
    gradient: ["rgba(67,86,255,0.32)", "rgba(157,124,230,0.16)"],
    tint: "#9D7CE6",
  },
  {
    key: "affirm",
    title: "Аффирмация\nдня",
    subtitle: "Подними энергию",
    Icon: Feather,
    gradient: ["rgba(255,215,154,0.34)", "rgba(239,160,192,0.18)"],
    tint: "#FFD79A",
  },
  {
    key: "intent",
    title: "Задать\nнамерение",
    subtitle: "Сфокусируй ум",
    Icon: Flower2,
    gradient: ["rgba(239,160,192,0.38)", "rgba(157,124,230,0.18)"],
    tint: "#EFA0C0",
  },
];

export default function HomeScreen() {
  const { streak, addItem, items } = useHistory();
  const [flipped, setFlipped] = useState(false);

  const dailyPhrase = useMemo(() => pickByDay(DAILY_PHRASES), []);
  const cardOfTheDay = useMemo(() => pickByDay(TAROT_DECK), []);
  const energy = useMemo(() => pickByDay(ENERGY_THEMES), []);

  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);
  const userName = "Путник";

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

  const handleDraw = () => {
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

  // Path / XP — derived from streak (placeholder formula)
  const xp = Math.min(600, 180 + streak * 20);
  const xpTotal = 600;
  const xpPct = Math.max(6, Math.round((xp / xpTotal) * 100));

  return (
    <View style={styles.root}>
      <CosmicBackground />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          testID="home-scroll"
        >
          {/* Top nav row */}
          <View style={styles.topBar}>
            <Pressable
              style={styles.iconButton}
              hitSlop={8}
              testID="home-menu-btn"
            >
              <Menu color={theme.colors.text} size={20} strokeWidth={1.8} />
            </Pressable>
            <Pressable
              style={styles.iconButton}
              hitSlop={8}
              testID="home-bell-btn"
            >
              <Bell color={theme.colors.text} size={19} strokeWidth={1.8} />
              <View style={styles.notifDot} />
            </Pressable>
          </View>

          {/* Greeting block */}
          <View style={styles.greetingBlock}>
            <Text style={styles.greetingSmall} testID="home-greeting-small">
              {greeting},
            </Text>
            <View style={styles.greetingNameRow}>
              <Text style={styles.greetingName} testID="home-greeting">
                {userName}
              </Text>
              <View style={styles.greetSparkle}>
                <Sparkles color={theme.colors.gold} size={18} strokeWidth={1.6} />
              </View>
            </View>
            <Text style={styles.greetingSub}>
              Готов(а) настроиться на энергию дня?
            </Text>
          </View>

          {/* Hero decorative slot (image later) */}
          <View style={styles.heroSlot} testID="home-hero-slot">
            <LinearGradient
              colors={["rgba(239,160,192,0.20)", "rgba(53,43,98,0.0)"]}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroMoon}>
              <Moon color={theme.colors.gold} size={22} strokeWidth={1.4} />
            </View>
            <View style={[styles.heroStar, { top: 20, left: 40 }]} />
            <View style={[styles.heroStar, { top: 58, left: 140 }]} />
            <View style={[styles.heroStar, { top: 34, right: 90 }]} />
            <View style={[styles.heroStar, { top: 88, right: 30 }]} />
          </View>

          {/* Tarot of the Day */}
          <GlassCard
            glow="purple"
            borderColor={theme.colors.borderPurple}
            style={styles.bigCard}
          >
            <View style={styles.bigCardInner}>
              <View style={styles.bigCardText}>
                <View style={styles.eyebrowRow}>
                  <Sun color={theme.colors.gold} size={14} strokeWidth={1.6} />
                  <Text style={styles.eyebrow}>ТАРО ДНЯ</Text>
                </View>
                <Text style={styles.bigCardTitle}>
                  Вытяни карту{"\n"}дня
                </Text>
                <Text style={styles.bigCardSub}>
                  Получи руководство{"\n"}и ясность на сегодня.
                </Text>

                <Pressable
                  onPress={handleDraw}
                  style={styles.ctaWrap}
                  testID="home-draw-card-btn"
                >
                  <LinearGradient
                    colors={["#EFA0C0", "#B98BE5", "#9D7CE6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ctaGradient}
                  >
                    <Text style={styles.ctaText}>
                      {flipped ? "Карта открыта" : "Вытянуть"}
                    </Text>
                    <Sparkles color="#FFF7EA" size={14} strokeWidth={1.8} />
                  </LinearGradient>
                </Pressable>
              </View>

              {/* Right-side card slot */}
              <View style={styles.bigCardArt}>
                {flipped ? (
                  <TarotCard
                    card={cardOfTheDay}
                    flipped={flipped}
                    onFlip={() => {}}
                    width={112}
                    height={168}
                    testID="card-of-the-day"
                  />
                ) : (
                  <View style={styles.cardPlaceholder}>
                    <LinearGradient
                      colors={["#33285C", "#1B1830"]}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.cardPlaceholderBorder} />
                    <Sun
                      color={theme.colors.gold}
                      size={28}
                      strokeWidth={1.2}
                    />
                    <View style={styles.cardPlaceholderStars}>
                      <View style={styles.tinyStar} />
                      <View style={styles.tinyStar} />
                      <View style={styles.tinyStar} />
                    </View>
                  </View>
                )}
              </View>
            </View>

            {flipped && (
              <View style={styles.cardRevealRow}>
                <Text style={styles.cardRevealName} testID="card-of-the-day-name">
                  {cardOfTheDay.nameRu}
                </Text>
                <Text style={styles.cardRevealText}>
                  {cardOfTheDay.short}
                </Text>
              </View>
            )}
          </GlassCard>

          {/* Energy of the Day */}
          <GlassCard
            borderColor={theme.colors.borderPurple}
            style={styles.energyCard}
          >
            <View style={styles.energyInner}>
              <View style={styles.energyText}>
                <View style={styles.eyebrowRow}>
                  <Sun color={theme.colors.gold} size={14} strokeWidth={1.6} />
                  <Text style={styles.eyebrow}>ЭНЕРГИЯ ДНЯ</Text>
                </View>
                <Text style={styles.energyTitle}>{energy.title}</Text>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteMark}>“</Text>
                  <Text style={styles.quoteText} testID="energy-phrase">
                    {energy.quote || dailyPhrase}
                  </Text>
                </View>
              </View>

              <View style={styles.crystalSlot}>
                <LinearGradient
                  colors={["rgba(196,123,234,0.34)", "rgba(53,43,98,0.0)"]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.crystalShape} />
                <View style={styles.crystalShapeSm} />
                <View style={[styles.tinyStar, { top: 8, right: 14 }]} />
                <View style={[styles.tinyStar, { top: 28, left: 8 }]} />
              </View>
            </View>
          </GlassCard>

          {/* Quick Rituals */}
          <View style={styles.sectionHead}>
            <Text style={styles.sectionEyebrow}>БЫСТРЫЕ РИТУАЛЫ</Text>
            <Pressable style={styles.seeAllBtn} hitSlop={8}>
              <Text style={styles.seeAllText}>Все</Text>
              <ChevronRight color={theme.colors.textDim} size={14} />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.ritualsRow}
          >
            {QUICK_RITUALS.map((r) => (
              <GlassCard
                key={r.key}
                borderColor={theme.colors.border}
                style={styles.ritualCard}
              >
                <View style={styles.ritualInner}>
                  <View style={styles.ritualArt}>
                    <LinearGradient
                      colors={r.gradient}
                      style={StyleSheet.absoluteFill}
                    />
                    <r.Icon color={r.tint} size={30} strokeWidth={1.4} />
                  </View>
                  <Text style={styles.ritualTitle} numberOfLines={2}>
                    {r.title}
                  </Text>
                  <Text style={styles.ritualSub} numberOfLines={1}>
                    {r.subtitle}
                  </Text>
                </View>
              </GlassCard>
            ))}
          </ScrollView>

          {/* Streak + Path */}
          <GlassCard
            borderColor={theme.colors.borderPurple}
            style={styles.pathCard}
          >
            <View style={styles.pathInner}>
              {/* Streak */}
              <View style={styles.pathLeft}>
                <Text style={styles.sectionEyebrow}>РИТУАЛ-СЕРИЯ</Text>
                <View style={styles.streakRow}>
                  <View style={styles.streakRing}>
                    <LinearGradient
                      colors={["rgba(255,215,154,0.28)", "rgba(157,124,230,0.16)"]}
                      style={StyleSheet.absoluteFill}
                    />
                    <Flame color={theme.colors.gold} size={24} strokeWidth={1.6} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.streakNumber} testID="streak-badge">
                      {streak}{" "}
                      <Text style={styles.streakUnit}>дн.</Text>
                    </Text>
                    <Text style={styles.streakCaption}>
                      Продолжай —{"\n"}энергия в потоке.
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.pathDivider} />

              {/* Path */}
              <View style={styles.pathRight}>
                <Text style={styles.sectionEyebrow}>ТВОЙ ПУТЬ</Text>
                <Text style={styles.pathRank}>Начинающий{"\n"}Мистик</Text>
                <View style={styles.progressTrack}>
                  <LinearGradient
                    colors={["#EFA0C0", "#9D7CE6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${xpPct}%` }]}
                  />
                </View>
                <Text style={styles.pathXp}>
                  {xp} / {xpTotal} XP
                </Text>
              </View>

              <View style={styles.badgeCircle}>
                <Compass color={theme.colors.gold} size={22} strokeWidth={1.5} />
              </View>
            </View>
          </GlassCard>

          <View style={{ height: 140 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 4 },

  /* Top bar */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 18,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(35,31,58,0.55)",
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  notifDot: {
    position: "absolute",
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.gold,
    shadowColor: theme.colors.gold,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },

  /* Greeting */
  greetingBlock: {
    marginBottom: 14,
  },
  greetingSmall: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: 0.2,
  },
  greetingNameRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginTop: 2,
  },
  greetingName: {
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: 0.3,
  },
  greetSparkle: {
    paddingBottom: 12,
  },
  greetingSub: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 260,
  },

  /* Hero decorative slot */
  heroSlot: {
    height: 130,
    borderRadius: 22,
    marginTop: 6,
    marginBottom: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(35,31,58,0.32)",
  },
  heroMoon: {
    position: "absolute",
    top: 18,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,215,154,0.08)",
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
  },
  heroStar: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.gold,
    opacity: 0.65,
    shadowColor: theme.colors.gold,
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },

  /* Eyebrow */
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  eyebrow: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10.5,
    letterSpacing: 2.4,
  },

  /* Big card — Tarot of the Day */
  bigCard: {
    marginBottom: 18,
  },
  bigCardInner: {
    flexDirection: "row",
    padding: 22,
    gap: 14,
  },
  bigCardText: {
    flex: 1,
    paddingRight: 4,
  },
  bigCardTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: 0.2,
  },
  bigCardSub: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  ctaWrap: {
    marginTop: 18,
    borderRadius: 999,
    alignSelf: "flex-start",
    shadowColor: theme.colors.pink,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  ctaGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 999,
  },
  ctaText: {
    color: "#FFF7EA",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
    letterSpacing: 0.4,
  },

  /* Tarot card slot (right) */
  bigCardArt: {
    width: 118,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  cardPlaceholder: {
    width: 112,
    height: 168,
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    transform: [{ rotate: "-6deg" }],
  },
  cardPlaceholderBorder: {
    ...StyleSheet.absoluteFillObject,
    margin: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,215,154,0.35)",
  },
  cardPlaceholderStars: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
  },
  tinyStar: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.gold,
    opacity: 0.8,
  },
  cardRevealRow: {
    paddingHorizontal: 22,
    paddingBottom: 20,
    marginTop: -4,
  },
  cardRevealName: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.display,
    fontSize: 18,
    marginBottom: 4,
  },
  cardRevealText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
  },

  /* Energy card */
  energyCard: {
    marginBottom: 22,
  },
  energyInner: {
    flexDirection: "row",
    padding: 22,
    gap: 14,
    minHeight: 150,
  },
  energyText: {
    flex: 1,
    paddingRight: 4,
  },
  energyTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    fontSize: 22,
    lineHeight: 27,
    marginBottom: 12,
  },
  quoteRow: {
    flexDirection: "row",
    gap: 6,
  },
  quoteMark: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.display,
    fontSize: 26,
    lineHeight: 22,
    marginTop: 4,
  },
  quoteText: {
    flex: 1,
    color: theme.colors.textDim,
    fontFamily: theme.fonts.heading,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
  },
  crystalSlot: {
    width: 110,
    height: 120,
    alignSelf: "center",
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  crystalShape: {
    width: 38,
    height: 60,
    backgroundColor: "rgba(196,123,234,0.55)",
    borderWidth: 1,
    borderColor: "rgba(239,203,255,0.7)",
    transform: [{ skewY: "-6deg" }, { rotate: "4deg" }],
    borderRadius: 3,
    shadowColor: theme.colors.mauve,
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  crystalShapeSm: {
    position: "absolute",
    left: 28,
    bottom: 22,
    width: 22,
    height: 38,
    backgroundColor: "rgba(196,123,234,0.35)",
    borderWidth: 1,
    borderColor: "rgba(239,203,255,0.5)",
    transform: [{ rotate: "-8deg" }],
    borderRadius: 2,
  },

  /* Section head */
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 4,
  },
  sectionEyebrow: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10.5,
    letterSpacing: 2.4,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeAllText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.4,
  },

  /* Rituals row */
  ritualsRow: {
    gap: 12,
    paddingRight: 8,
    paddingBottom: 6,
    paddingLeft: 2,
  },
  ritualCard: {
    width: 150,
  },
  ritualInner: {
    padding: 14,
    alignItems: "center",
  },
  ritualArt: {
    width: 86,
    height: 86,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  ritualTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 16,
    lineHeight: 19,
    textAlign: "center",
  },
  ritualSub: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 11.5,
    marginTop: 4,
    textAlign: "center",
  },

  /* Path card */
  pathCard: {
    marginTop: 22,
  },
  pathInner: {
    flexDirection: "row",
    padding: 18,
    alignItems: "stretch",
    gap: 14,
  },
  pathLeft: {
    flex: 1,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
  },
  streakRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: theme.colors.borderGold,
  },
  streakNumber: {
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    fontSize: 26,
    lineHeight: 30,
  },
  streakUnit: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 13,
  },
  streakCaption: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
  pathDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  pathRight: {
    flex: 1.1,
  },
  pathRank: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 16,
    lineHeight: 19,
    marginTop: 10,
    marginBottom: 10,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  pathXp: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 11.5,
    marginTop: 6,
    letterSpacing: 0.4,
  },
  badgeCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: "rgba(255,215,154,0.10)",
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
  },
});
