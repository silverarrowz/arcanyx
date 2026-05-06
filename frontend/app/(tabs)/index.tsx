import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import Svg, {
  Defs,
  Mask,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import {
  Bell,
  BookOpenCheck,
  Circle,
  Compass,
  Flame,
  Menu,
  Moon,
  Sparkle,
  Sparkles,
  Sun,
} from "lucide-react-native";
import { theme } from "../../src/theme";
import CosmicBackground from "../../src/components/CosmicBackground";
import GlassCard from "../../src/components/GlassCard";
import SparkleField from "../../src/components/Sparkles";
import TarotCard from "../../src/components/TarotCard";
import { DAILY_PHRASES } from "../../src/data/tarotCards";
import { useHistory } from "../../src/context/HistoryContext";
import { todayKey, useDailyCard } from "../../src/hooks/useDailyCard";
import { getCardReading, getCardSuitTheme } from "../../src/data/tarotReadings";
import { getDailyQuote } from "../../src/data/dailyQuotes";

const HERO_BG = require("../../assets/home/bg-main.png");
const ENERGY_BG = require("../../assets/home/bg-energy.png");
const DREAM_BG = require("../../assets/home/bg-dream.png");
/** Фон секции «Цитата дня» — того же набора, что и hero/энергия/сонник */
const QUOTE_SECTION_BG = require("../../assets/home/bgi5.png");
const QUOTE_MARK_IMG = require("../../assets/home/quote3.png");
const TAROT_CARD_BACK = require("../../assets/tarot/card-back2.png");
const QR_ORACLE = require("../../assets/home/chrome-ball.png");
const QR_DREAMS = require("../../assets/home/chrome-dreams3.png");
const QR_AFFIRM = require("../../assets/home/chrome-aff.png");
const QR_TAROT = require("../../assets/home/chrom-tarot3.png");

function pickByDay<T>(arr: T[], dayKey: string): T {
  const [year, month, date] = dayKey.split("-").map(Number);
  const idx =
    (year * 372 + (month - 1) * 31 + date) % arr.length;
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
    title: "Развитие\nи Рост",
    quote: "То, что ты взращиваешь сегодня, расцветёт твоим завтра.",
    gradientRgb: [76, 168, 124] as const,
  },
  {
    title: "Ясность\nи Фокус",
    quote: "Тишина внутри — лучший компас для внешнего пути.",
    gradientRgb: [88, 156, 214] as const,
  },
  {
    title: "Принятие\nи Поток",
    quote: "Когда ты перестаёшь бороться, вселенная начинает вести.",
    gradientRgb: [72, 178, 196] as const,
  },
  {
    title: "Любовь\nи Мягкость",
    quote: "Нежность к себе — это магия, которую ты несёшь в мир.",
    gradientRgb: [214, 128, 168] as const,
  },
  {
    title: "Сила\nи Смелость",
    quote: "Каждый шаг в неизвестность — это шаг к самому себе.",
    gradientRgb: [214, 96, 108] as const,
  },
  {
    title: "Интуиция\nи Доверие",
    quote: "Твой внутренний голос знает путь раньше, чем разум его понимает.",
    gradientRgb: [108, 90, 214] as const,
  },
  {
    title: "Трансформация\nи Обновление",
    quote: "То, что отпускается, освобождает место для нового.",
    gradientRgb: [168, 88, 196] as const,
  },
  {
    title: "Гармония\nи Баланс",
    quote: "Равновесие приходит, когда ты позволяешь всему быть.",
    gradientRgb: [120, 172, 140] as const,
  },
  {
    title: "Осознанность\nи Присутствие",
    quote: "Настоящий момент — единственная точка силы.",
    gradientRgb: [212, 164, 96] as const,
  },
  {
    title: "Открытость\nи Возможности",
    quote: "Мир раскрывается перед тем, кто готов его увидеть.",
    gradientRgb: [96, 168, 228] as const,
  },
  {
    title: "Свобода\nи Лёгкость",
    quote: "Иногда самый сильный шаг — это позволить уйти.",
    gradientRgb: [176, 168, 224] as const,
  },
  {
    title: "Вдохновение\nи Творчество",
    quote: "Идеи приходят туда, где им дают пространство дышать.",
    gradientRgb: [186, 112, 214] as const,
  },
  {
    title: "Защита\nи Границы",
    quote: "Сохраняя себя, ты усиливаешь свою энергию.",
    gradientRgb: [96, 116, 176] as const,
  },
  {
    title: "Тишина\nи Внутренний Мир",
    quote: "В тишине ты находишь ответы, которых не слышно в шуме.",
    gradientRgb: [88, 96, 156] as const,
  },
  {
    title: "Движение\nи Путь",
    quote: "Даже маленький шаг запускает большие перемены.",
    gradientRgb: [214, 140, 88] as const,
  },
  {
    title: "Благодарность\nи Изобилие",
    quote: "Ценя то, что есть, ты открываешь двери для большего.",
    gradientRgb: [212, 176, 96] as const,
  },
  {
    title: "Чистота\nи Намерение",
    quote: "Чёткое намерение формирует ясную реальность.",
    gradientRgb: [188, 180, 214] as const,
  },
  {
    title: "Синхроничность\nи Знаки",
    quote: "Мир подаёт сигналы тем, кто готов их замечать.",
    gradientRgb: [152, 112, 214] as const,
  },
  {
    title: "Принятие\nи Исцеление",
    quote: "Приняв себя, ты начинаешь мягко меняться.",
    gradientRgb: [96, 188, 168] as const,
  },
  {
    title: "Свет\nи Раскрытие",
    quote: "То, что скрыто, стремится быть увиденным.",
    gradientRgb: [232, 196, 120] as const,
  },
];

/** Тёмная база под оверлей — светлые accent-RGB смешиваются с ней, чтобы не «съедать» светлый текст. */
const ENERGY_OVERLAY_BASE: readonly [number, number, number] = [35, 31, 58];

function srgbChannelToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb: readonly [number, number, number]): number {
  return (
    0.2126 * srgbChannelToLinear(rgb[0]) +
    0.7152 * srgbChannelToLinear(rgb[1]) +
    0.0722 * srgbChannelToLinear(rgb[2])
  );
}

function mixRgb(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t),
  ];
}

/** Светлые темы дают слишком светлый левый столбец градиента — подмешиваем surface-тёмноту. */
function energyOverlayRgb(rgb: readonly [number, number, number]): [number, number, number] {
  const lum = relativeLuminance(rgb);
  const t = Math.max(0, Math.min(1, (lum - 0.36) / 0.44));
  if (t <= 0) return [rgb[0], rgb[1], rgb[2]];
  const blend = 0.22 + t * 0.78;
  return mixRgb(rgb, ENERGY_OVERLAY_BASE, blend);
}

function energyCardGradient(
  rgb: readonly [number, number, number],
): readonly [string, string, string, string] {
  const [r, g, b] = energyOverlayRgb(rgb);
  return [
    `rgba(${r}, ${g}, ${b}, 0.95)`,
    `rgba(${r}, ${g}, ${b}, 0.95)`,
    `rgba(${r}, ${g}, ${b}, 0.75)`,
    `rgba(${r}, ${g}, ${b}, 0)`,
  ];
}

type Ritual = {
  key: string;
  title: string;
  subtitle: string;
  qrImage: ImageSourcePropType;
  icon: "moon" | "orb" | "sparkle" | "sun";
};

const QUICK_RITUALS: Ritual[] = [
  {
    key: "daily-spread",
    title: "Таро",
    subtitle: "Обрети ясность",
    qrImage: QR_TAROT,
    icon: "moon",
  },
  {
    key: "oracle",
    title: "Магический шар",
    subtitle: "Задай вопрос",
    qrImage: QR_ORACLE,
    icon: "orb",
  },
  {
    key: "dream",
    title: "Сны",
    subtitle: "Раскрой смысл",
    qrImage: QR_DREAMS,
    icon: "sparkle",
  },
  {
    key: "affirm",
    title: "Аффирмация",
    subtitle: "Настройся на лучшее",
    qrImage: QR_AFFIRM,
    icon: "sun",
  },
];

function QuickRitualIcon({
  kind,
  color,
  size,
}: {
  kind: Ritual["icon"];
  color: string;
  size: number;
}) {
  const stroke = 1.45;
  switch (kind) {
    case "moon":
      return <Moon color={color} size={size} strokeWidth={stroke} />;
    case "orb":
      return <Circle color={color} size={size} strokeWidth={stroke + 0.65} />;
    case "sparkle":
      return <Sparkle color={color} size={size} strokeWidth={stroke} />;
    default:
      return <Sun color={color} size={size} strokeWidth={stroke} />;
  }
}

function QuickRitualTile({
  ritual,
  width,
  entranceIndex,
  onPress,
}: {
  ritual: Ritual;
  width: number;
  entranceIndex: number;
  onPress: () => void;
}) {
  const pressProgress = useSharedValue(0);

  const pressFeedbackStyle = useAnimatedStyle(() => {
    const t = pressProgress.value;
    return {
      opacity: 1 - t * 0.08,
      transform: [{ scale: 1 - t * 0.035 }],
    };
  });

  const handlePressIn = useCallback(() => {
    pressProgress.value = withTiming(1, {
      duration: 130,
      easing: Easing.out(Easing.quad),
    });
  }, [pressProgress]);

  const handlePressOut = useCallback(() => {
    pressProgress.value = withTiming(0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [pressProgress]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.ritualPressable, { width }]}
    >
      <Animated.View style={[styles.ritualPressAnim, pressFeedbackStyle]}>
        <Animated.View
          entering={FadeInDown.delay(entranceIndex * 70).duration(520)}
          style={styles.ritualAppearWrap}
        >
          <View style={styles.ritualCardClip}>
            <Image
              source={ritual.qrImage}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              contentPosition="center"
              transition={200}
              pointerEvents="none"
            />
            <LinearGradient
              pointerEvents="none"
              colors={[
                "rgba(0,0,0,0)",
                "rgba(28,22,48,0.14)",
                "rgba(18,12,34,0.48)",
                "rgba(10,7,22,0.78)",
                "rgba(6,4,14,0.94)",
              ]}
              locations={[0, 0.42, 0.62, 0.82, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              pointerEvents="none"
              colors={["transparent", "rgba(8,4,18,0.72)", "rgba(4,2,12,0.96)"]}
              locations={[0, 0.55, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.ritualTextBandGradient}
            />
            <View style={styles.ritualCardFooter}>
              <QuickRitualIcon kind={ritual.icon} color="#FFFFFF" size={21} />
              <Text style={styles.ritualTitleImg} numberOfLines={2}>
                {ritual.title}
              </Text>
              <Text style={styles.ritualSubImg} numberOfLines={2}>
                {ritual.subtitle}
              </Text>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const DREAM_PROMPTS = ["падение", "полет", "вода", "зубы", "..."];

/** Высота поля сна на главной (меньше, чем на экране сонника); скролл внутри */
const HOME_DREAM_INPUT_H = 116;

/**
 * Undrawn «Таро дня» — ореол за рубашкой карты + искры (только главная).
 *
 * | Параметр | Где править |
 * |------------|-------------|
 * | Разрешен вылет контента за скругление стекла | `allowOverflow={!hasDrawn}` у `<GlassCard>` «Таро дня» (только пока карта не вытянута). Реализация: `GlassCard.tsx` (`overflowBackdropClip` + blur). |
 * | Рамка позиционирования ореола (до SVG) | `DAILY_TAROT_UNDRAWN_AURA.outer` ниже + `styles.cardBackAuraOuter` |
 * | Холст SVG (граница «обрезки» растрового градиента) | `DAILY_TAROT_UNDRAWN_AURA.svg` |
 * | Центр/радиус градиента (маска перьевая и цвет — общие) | `DAILY_TAROT_UNDRAWN_AURA.radial` в JSX у `RadialGradient` |
 * | Прозрачность по краю (убрать прямоугольник) | `<Stop>` внутри `homeDailyCardAuraFeather` |
 * | Цвет ореола | `<Stop>` внутри `homeDailyCardAura` |
 * | Пульс яркости/масштаба ореола | `cardBackAuraStyle` + `drawCtaGlow` в `HomeScreen` |
 * | Искры вокруг карты | `SparkleField` count/size + `styles.cardBackSparkleField` / `cardBackSparkleFieldInner` |
 * | Слот карты | `styles.bigCardArt`, `styles.cardPlaceholder` |
 * | Обрезка при скролле | `ScrollView` на этой странице: `removeClippedSubviews={false}` |
 */
const DAILY_TAROT_UNDRAWN_AURA = {
  svg: { w: 280, h: 400 },
  outer: { w: 280, h: 380, left: -81, top: -70 },
  rotateDeg: "-6deg" as const,
  radial: {
    cx: "70%",
    cy: "48%",
    r: "78%",
    fx: "44%",
    fy: "35%",
  },
} as const;

export default function HomeScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { streak } = useHistory();
  const [currentDayKey, setCurrentDayKey] = useState(() => todayKey());
  const [dreamText, setDreamText] = useState("");
  const [dreamHintVisible, setDreamHintVisible] = useState(false);
  const {
    card: dailyCard,
    hasDrawn,
    loading: dailyCardLoading,
    refresh: refreshDailyCard,
  } = useDailyCard();

  const drawCtaGlow = useSharedValue(0);

  useEffect(() => {
    if (hasDrawn || dailyCardLoading) {
      cancelAnimation(drawCtaGlow);
      drawCtaGlow.value = 0;
      return;
    }
    drawCtaGlow.value = withRepeat(
      withTiming(1, {
        duration: 1500,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    // drawCtaGlow is a stable ref from useSharedValue; listed for exhaustive-deps.
  }, [hasDrawn, dailyCardLoading, drawCtaGlow]);

  const drawCtaHaloStyle = useAnimatedStyle(() => {
    const t = drawCtaGlow.value;
    return {
      opacity: 0.24 + t * 0.5,
      transform: [{ scale: 0.96 + t * 0.12 }],
    };
  });

  const drawCtaButtonStyle = useAnimatedStyle(() => {
    const t = drawCtaGlow.value;
    return {
      transform: [{ scale: 0.994 + t * 0.022 }],
      shadowOpacity: 0.42 + t * 0.34,
      shadowRadius: 12 + t * 14,
    };
  });

  const cardBackAuraStyle = useAnimatedStyle(() => {
    const t = drawCtaGlow.value;
    return {
      opacity: 0.52 + t * 0.38,
      transform: [{ scale: 0.9 + t * 0.14 }],
    };
  });

  const handleQuickRitualPress = useCallback(
    (key: string) => {
      if (key === "oracle") router.push("/(tabs)/gadania?tab=oracle");
      if (key === "daily-spread") router.push("/(tabs)/gadania?tab=tarot");
      if (key === "dream") router.push("/(tabs)/dreambook");
    },
    [router],
  );

  /** Ширина как у прежней крупной карточки в бенто (доля 1.08 от пары 1.08+1). */
  const ritualCardWidth = useMemo(() => {
    const inner = windowWidth - 40;
    const gap = 12;
    const w = Math.round((inner - gap) * (1.08 / 2.08));
    return Math.min(320, Math.max(220, w));
  }, [windowWidth]);

  const renderRitualTile = (r: Ritual, entranceIndex: number) => {
    return (
      <QuickRitualTile
        key={r.key}
        ritual={r}
        width={ritualCardWidth}
        entranceIndex={entranceIndex}
        onPress={() => handleQuickRitualPress(r.key)}
      />
    );
  };

  const syncLocalDay = useCallback(() => {
    setCurrentDayKey(todayKey());
  }, []);

  useFocusEffect(
    useCallback(() => {
      syncLocalDay();
      void refreshDailyCard();
    }, [refreshDailyCard, syncLocalDay]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") syncLocalDay();
    });
    return () => sub.remove();
  }, [syncLocalDay]);

  useEffect(() => {
    const id = setInterval(syncLocalDay, 30_000);
    return () => clearInterval(id);
  }, [syncLocalDay]);

  const dailyPhrase = useMemo(
    () => pickByDay(DAILY_PHRASES, currentDayKey),
    [currentDayKey],
  );
  const energy = useMemo(
    () => pickByDay(ENERGY_THEMES, currentDayKey),
    [currentDayKey],
  );
  const dailyQuote = useMemo(() => getDailyQuote(currentDayKey), [currentDayKey]);
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);
  const userName = "Диана";

  // Get the reading data for the drawn card (if any)
  const dailyReading = useMemo(() => {
    if (!dailyCard) return null;
    return getCardReading(dailyCard);
  }, [dailyCard]);
  const dailySuitTheme = useMemo(() => {
    if (!dailyCard) return null;
    return getCardSuitTheme(dailyCard);
  }, [dailyCard]);

  // Navigate to full draw ritual
  const handleGoToDraw = () => {
    router.push("/draw-card");
  };

  const handleDreamPrompt = useCallback((prompt: string) => {
    if (prompt === "...") return;
    setDreamHintVisible(false);
    setDreamText((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return prompt;
      return trimmed.toLowerCase().includes(prompt) ? prev : `${prev.trim()} ${prompt}`;
    });
  }, []);

  const handleDreamInterpret = useCallback(() => {
    if (!dreamText.trim()) return;
    setDreamHintVisible(true);
  }, [dreamText]);

  // Path / XP — derived from streak (placeholder formula)
  const xp = Math.min(600, 180 + streak * 20);
  const xpTotal = 600;
  const xpPct = Math.max(6, Math.round((xp / xpTotal) * 100));

  const dreamReady = dreamText.trim().length > 0;

  return (
    <View style={styles.root}>
      <CosmicBackground />
      <SafeAreaView style={styles.safe} edges={[]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            removeClippedSubviews={false}
            testID="home-scroll"
          >
          {/* Hero with background illustration */}
          <View style={styles.heroContainer}>
            <Image
              source={HERO_BG}
              style={styles.heroImage}
              contentFit="cover"
              contentPosition="top right"
              transition={300}
            />
            {/* Gradient fade — keeps top crisp, blends bottom into theme bg */}
            <LinearGradient
              colors={[
                "rgba(18,16,34,0.0)",
                "rgba(18,16,34,0.0)",
                "rgba(18,16,34,0.55)",
                theme.colors.bg,
              ]}
              locations={[0, 0.55, 0.85, 1]}
              style={StyleSheet.absoluteFillObject}
            />
            {/* Subtle left-side darken so greeting text stays readable */}
            <LinearGradient
              colors={["rgba(18,16,34,0.55)", "rgba(18,16,34,0.0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />

            {/* Top nav row */}
            <View
              style={[
                styles.topBar,
                { paddingTop: Math.max(insets.top, 12) },
              ]}
            >
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
                  <Sparkles
                    color={theme.colors.gold}
                    size={18}
                    strokeWidth={1.6}
                  />
                </View>
              </View>
              <Text style={styles.greetingSub}>
                Готов(а) настроиться на энергию дня?
              </Text>
            </View>
          </View>

          <View style={styles.contentWrap}>
          {/* Tarot of the Day */}
          <GlassCard
            glow="purple"
            borderColor={hasDrawn && dailySuitTheme ? dailySuitTheme.border : theme.colors.borderPurple}
            intensity={14}
            surfaceColor={
              hasDrawn && dailySuitTheme ? dailySuitTheme.tint : "rgba(98,82,142,0.22)"
            }
            overlayColor={
              hasDrawn && dailySuitTheme
                ? "rgba(25, 21, 40, 0.24)"
                : "rgba(116,95,168,0.18)"
            }
            allowOverflow={!hasDrawn}
            style={styles.bigCard}
          >
            {/* State: Not yet drawn today OR loading */}
            {!hasDrawn && (
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

                  <View style={[styles.ctaWrap, styles.drawCtaWrap]}>
                    <SparkleField
                      count={6}
                      size={150}
                      style={styles.drawCtaSparkleField}
                    />
                    <Animated.View
                      pointerEvents="none"
                      style={[styles.drawCtaHalo, drawCtaHaloStyle]}
                    />
                    <Animated.View style={[styles.drawCtaAnimatedButton, drawCtaButtonStyle]}>
                      <Pressable
                        onPress={handleGoToDraw}
                        style={({ pressed }) => [
                          styles.ctaPressableFill,
                          pressed && !dailyCardLoading && { opacity: 0.92 },
                        ]}
                        testID="home-draw-card-btn"
                        disabled={dailyCardLoading}
                      >
                        <LinearGradient
                          colors={theme.gradients.primaryCta}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.ctaGradient}
                        >
                          <Text style={styles.ctaText}>
                            {dailyCardLoading ? "Загрузка…" : "Вытянуть"}
                          </Text>
                          <Sparkles color="#FFF7EA" size={14} strokeWidth={1.8} />
                        </LinearGradient>
                      </Pressable>
                    </Animated.View>
                  </View>
                </View>

                {/* Right-side card placeholder */}
                <View style={styles.bigCardArt}>
                  <View style={styles.cardBackAuraOuter} pointerEvents="none">
                    <Animated.View style={[styles.cardBackAuraInner, cardBackAuraStyle]}>
                      <Svg
                        width={DAILY_TAROT_UNDRAWN_AURA.svg.w}
                        height={DAILY_TAROT_UNDRAWN_AURA.svg.h}
                        style={styles.cardBackAuraSvg}
                      >
                        <Defs>
                          {/* Feather mask: luminance → alpha at edges (pairs with larger SVG canvas). */}
                          <RadialGradient
                            id="homeDailyCardAuraFeather"
                            cx={DAILY_TAROT_UNDRAWN_AURA.radial.cx}
                            cy={DAILY_TAROT_UNDRAWN_AURA.radial.cy}
                            r={DAILY_TAROT_UNDRAWN_AURA.radial.r}
                            fx={DAILY_TAROT_UNDRAWN_AURA.radial.fx}
                            fy={DAILY_TAROT_UNDRAWN_AURA.radial.fy}
                          >
                            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
                            <Stop offset="35%" stopColor="#FFFFFF" stopOpacity={0.68} />
                            <Stop offset="58%" stopColor="#FFFFFF" stopOpacity={0.18} />
                            <Stop offset="74%" stopColor="#FFFFFF" stopOpacity={0} />
                            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
                          </RadialGradient>
                          <Mask id="homeDailyCardAuraMask" maskType="luminance">
                            <Rect width="100%" height="100%" fill="url(#homeDailyCardAuraFeather)" />
                          </Mask>
                          <RadialGradient
                            id="homeDailyCardAura"
                            cx={DAILY_TAROT_UNDRAWN_AURA.radial.cx}
                            cy={DAILY_TAROT_UNDRAWN_AURA.radial.cy}
                            r={DAILY_TAROT_UNDRAWN_AURA.radial.r}
                            fx={DAILY_TAROT_UNDRAWN_AURA.radial.fx}
                            fy={DAILY_TAROT_UNDRAWN_AURA.radial.fy}
                          >
                            <Stop offset="0%" stopColor="#FFF7EA" stopOpacity={0.58} />
                            <Stop offset="20%" stopColor="#FFD79A" stopOpacity={0.42} />
                            <Stop offset="40%" stopColor="#EFA0C0" stopOpacity={0.32} />
                            <Stop offset="58%" stopColor="#9D7CE6" stopOpacity={0.2} />
                            <Stop offset="76%" stopColor="#9D7CE6" stopOpacity={0.08} />
                            <Stop offset="100%" stopColor="#9D7CE6" stopOpacity={0} />
                          </RadialGradient>
                        </Defs>
                        <Rect
                          width="100%"
                          height="100%"
                          fill="url(#homeDailyCardAura)"
                          mask="url(#homeDailyCardAuraMask)"
                        />
                      </Svg>
                    </Animated.View>
                  </View>
                  <SparkleField
                    count={13}
                    size={196}
                    style={styles.cardBackSparkleField}
                  />
                  <SparkleField
                    count={8}
                    size={148}
                    style={styles.cardBackSparkleFieldInner}
                  />
                  <View style={styles.cardPlaceholder}>
                    <Image
                      source={TAROT_CARD_BACK}
                      style={styles.cardPlaceholderImage}
                      contentFit="cover"
                      transition={150}
                    />
                    <View style={styles.cardPlaceholderBorder} />
                  </View>
                </View>
              </View>
            )}

            {/* State: Already drawn today */}
            {hasDrawn && dailyCard && (
              <>
                <View style={styles.bigCardInner}>
                  <View style={styles.bigCardText}>
                    <View style={styles.eyebrowRow}>
                      <Sun color={theme.colors.gold} size={14} strokeWidth={1.6} />
                      <Text style={styles.eyebrow}>ТВОЯ КАРТА ДНЯ</Text>
                    </View>
                    <Text style={styles.cardRevealName} testID="card-of-the-day-name">
                      {dailyCard.nameRu}
                    </Text>
                    
                    {dailyReading && (
                      <View
                        style={[
                          styles.energyPillSmall,
                          dailySuitTheme && {
                            borderColor: dailySuitTheme.border,
                            backgroundColor: dailySuitTheme.tint,
                          },
                        ]}
                      >
                        <Sparkles color={theme.colors.gold} size={10} strokeWidth={1.8} />
                        <Text style={styles.energyPillText}>
                          {dailyReading.energy.toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <Pressable
                      onPress={handleGoToDraw}
                      style={styles.ctaWrap}
                      testID="home-open-reading-btn"
                    >
                      <LinearGradient
                        colors={theme.gradients.primaryCta}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.ctaGradient}
                      >
                        <BookOpenCheck color="#FFF7EA" size={14} strokeWidth={1.8} />
                        <Text style={styles.ctaText}>Подробнее</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>

                  {/* Right-side: actual drawn card */}
                  <View style={styles.bigCardArt}>
                    <TarotCard
                      card={dailyCard}
                      flipped={true}
                      onFlip={() => {}}
                      width={112}
                      height={168}
                      testID="card-of-the-day"
                    />
                  </View>
                </View>

                {/* Quote row below the card */}
                {dailyReading && (
                  <View style={styles.cardQuoteRow}>
                    <Text style={styles.cardQuoteText}>
                      <Text style={styles.quoteSpan}>{"“\u00A0"}</Text>
                      {dailyReading.quote}
                      <Text style={styles.quoteSpan}>{"\u00A0„"}</Text>
                    </Text>
                  </View>
                )}
              </>
            )}
          </GlassCard>

          {/* Energy of the Day */}
          <GlassCard
            borderColor={theme.colors.borderPurple}
            style={styles.energyCard}
          >
            {/* Background image positioned to the right */}
            <Image
              source={ENERGY_BG}
              style={styles.energyBgImage}
              contentFit="cover"
              contentPosition="right center"
            />
            {/* Gradient overlay to blend with card and keep text readable */}
            <LinearGradient
              colors={energyCardGradient(energy.gradientRgb)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              locations={[0, 0.15, 0.4, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.energyInner}>
              <View style={styles.energyText}>
                <View style={styles.eyebrowRow}>
                  <Sun color={theme.colors.gold} size={14} strokeWidth={1.6} />
                  <Text style={styles.eyebrow}>ЭНЕРГИЯ ДНЯ</Text>
                </View>
                <Text style={styles.energyTitle}>{energy.title}</Text>
                <Text style={styles.quoteText} testID="energy-phrase">
                  <Text style={styles.quoteSpan}>{"“\u00A0"}</Text>
                  {energy.quote || dailyPhrase}
                  <Text style={styles.quoteSpan}>{"\u00A0„"}</Text>
                </Text>
              </View>
            </View>
          </GlassCard>

          {/* Dream interpretation */}
          <GlassCard
            borderColor={theme.colors.borderPurple}
            style={styles.dreamCard}
          >
            <Image
              source={DREAM_BG}
              style={styles.dreamBgImage}
              contentFit="cover"
              contentPosition="left center"
            />
            <LinearGradient
              colors={[
                "rgba(24,22,40,0.94)",
                "rgba(24,22,40,0.72)",
                "rgba(24,22,40,0.38)",
                "rgba(24,22,40,0.2)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              locations={[0, 0.28, 0.58, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.dreamInner}>
              <View style={styles.dreamCopy}>
                <View style={styles.eyebrowRow}>
                  <Moon color={theme.colors.gold} size={15} strokeWidth={1.7} />
                  <Text style={styles.eyebrow}>ЧТО ВАМ СЕГОДНЯ СНИЛОСЬ?</Text>
                </View>
                <GlassCard
                  glow="purple"
                  borderColor={theme.colors.borderPurple}
                  intensity={18}
                  surfaceColor="rgba(98,82,142,0.22)"
                  overlayColor="rgba(116,95,168,0.18)"
                  style={styles.dreamInputCard}
                >
                  <TextInput
                    value={dreamText}
                    onChangeText={(text) => {
                      setDreamText(text);
                      setDreamHintVisible(false);
                    }}
                    placeholder="Мне приснилось..."
                    placeholderTextColor={theme.colors.textDim}
                    multiline
                    scrollEnabled
                    textAlignVertical="top"
                    style={styles.dreamInput}
                    testID="dream-input"
                    underlineColorAndroid="transparent"
                  />
                </GlassCard>
                <View style={styles.dreamPromptRow}>
                  {DREAM_PROMPTS.map((prompt) => (
                    <Pressable
                      key={prompt}
                      onPress={() => handleDreamPrompt(prompt)}
                      style={styles.dreamPromptPill}
                      hitSlop={6}
                    >
                      <Text style={styles.dreamPromptText}>{prompt}</Text>
                    </Pressable>
                  ))}
                </View>
                {dreamHintVisible && (
                  <Text style={styles.dreamComingSoon}>
                    Толкование снов скоро появится здесь.
                  </Text>
                )}
              </View>
              <Pressable
                onPress={handleDreamInterpret}
                disabled={!dreamReady}
                style={[
                  styles.ctaWrap,
                  styles.dreamCtaWrap,
                  !dreamReady && styles.dreamCtaInactive,
                ]}
                testID="dream-interpret-btn"
              >
                <LinearGradient
                  colors={
                    dreamReady
                      ? theme.gradients.primaryCta
                      : theme.gradients.primaryCtaMuted
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.ctaGradient, styles.dreamCtaWide]}
                >
                  <Text
                    style={[
                      styles.ctaText,
                      !dreamReady && styles.dreamCtaTextInactive,
                    ]}
                  >
                    Узнать значение
                  </Text>
                  <Sparkles
                    color={dreamReady ? "#FFF7EA" : "#C9BED6"}
                    size={14}
                    strokeWidth={1.8}
                  />
                </LinearGradient>
              </Pressable>
            </View>
          </GlassCard>

          {/* Quick Rituals */}
          <View style={styles.sectionHead}>
            <Text style={styles.sectionEyebrow}>РИТУАЛЫ НА СЕГОДНЯ</Text>
          
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.ritualsRowScroll}
            contentContainerStyle={styles.ritualsRowContent}
          >
            {QUICK_RITUALS.map((r, i) => renderRitualTile(r, i))}
          </ScrollView>

          <GlassCard borderColor={theme.colors.borderPurple} style={styles.dailyQuoteCard}>
            <Image
              source={QUOTE_SECTION_BG}
              style={styles.dailyQuoteBgImage}
              contentFit="cover"
              contentPosition="center"
            />
            <LinearGradient
              colors={[
                "rgba(24,22,40,0.92)",
                "rgba(24,22,40,0.78)",
                "rgba(24,22,40,0.55)",
                "rgba(18,16,34,0.35)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              locations={[0, 0.35, 0.65, 1]}
              style={styles.dailyQuoteGradient}
            />
            <View style={styles.dailyQuoteInner}>
              {/* <View style={styles.eyebrowRow}>
                <Text style={styles.eyebrow}>ЦИТАТА ДНЯ</Text>
              </View> */}
              <View style={styles.dailyQuoteQuoteRow}>
                <Image
                  source={QUOTE_MARK_IMG}
                  style={styles.dailyQuoteMarkImage}
                  contentFit="contain"
                />
                <View style={styles.dailyQuoteBodyCol}>
                  <Text style={styles.dailyQuoteText} testID="daily-quote">
                    {dailyQuote.text}
                  </Text>
                  <Text style={styles.dailyQuoteAuthor} testID="daily-quote-author">
                  — {dailyQuote.author}
                  </Text>
                </View>
              </View>
            </View>
          </GlassCard>

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
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 0, paddingTop: 0 },

  contentWrap: { paddingHorizontal: 20 },

  /* Top bar */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 0,
    marginBottom: 10,
    paddingHorizontal: 20,
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
    paddingHorizontal: 20,
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
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 140,
  },

  /* Hero with background illustration */
  heroContainer: {
    width: "100%",
    minHeight: 410,
    paddingTop: 0,
    paddingBottom: 20,
    marginBottom: -40,
    overflow: "hidden",
  },
  heroImage: {
    position: "absolute",
    top: -90,
    left: 0,
    right: 0,
    bottom: -30,
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
    ...theme.shadows.ctaPrimary,
  },
  drawCtaWrap: {
    position: "relative",
    overflow: "visible",
    shadowColor: "#FFD6EE",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.58,
    shadowRadius: 12,
    elevation: 14,
  },
  drawCtaSparkleField: {
    position: "absolute",
    top: -50,
    left: -20,
    width: 150,
    height: 150,
    opacity: 0.88,
  },
  drawCtaAnimatedButton: {
    borderRadius: 999,
    shadowColor: "#FFD6EE",
    shadowOffset: { width: 0, height: 3 },
    elevation: 14,
  },
  drawCtaHalo: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 999,
    backgroundColor: "transparent",
    shadowColor: "#FFD6EE",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
  },
  ctaPressableFill: {
    borderRadius: 999,
    overflow: "hidden",
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
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    zIndex: 0,
  },
  cardBackAuraOuter: {
    position: "absolute",
    width: DAILY_TAROT_UNDRAWN_AURA.outer.w,
    height: DAILY_TAROT_UNDRAWN_AURA.outer.h,
    left: DAILY_TAROT_UNDRAWN_AURA.outer.left,
    top: DAILY_TAROT_UNDRAWN_AURA.outer.top,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: DAILY_TAROT_UNDRAWN_AURA.rotateDeg }],
    zIndex: 0,
  },
  cardBackAuraInner: {
    width: DAILY_TAROT_UNDRAWN_AURA.outer.w,
    height: DAILY_TAROT_UNDRAWN_AURA.outer.h,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBackAuraSvg: {
    opacity: 0.95,
  },
  cardBackSparkleField: {
    position: "absolute",
    top: -22,
    left: -28,
    width: 196,
    height: 196,
    opacity: 0.96,
    zIndex: 1,
  },
  cardBackSparkleFieldInner: {
    position: "absolute",
    top: 14,
    left: -12,
    width: 148,
    height: 148,
    opacity: 0.78,
    zIndex: 1,
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
    zIndex: 2,
  },
  cardPlaceholderImage: {
    ...StyleSheet.absoluteFillObject,
  },
  cardPlaceholderBorder: {
    ...StyleSheet.absoluteFillObject,
    margin: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,215,154,0.35)",
  },
  cardRevealName: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.display,
    fontSize: 22,
    lineHeight: 26,
    marginBottom: 6,
  },
  energyPillSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
  },
  energyPillText: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 9,
    letterSpacing: 1.6,
  },
  cardQuoteRow: {
    paddingHorizontal: 22,
    paddingBottom: 20,
    marginTop: -4,
  },
  cardQuoteText: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 16,
    lineHeight: 19,
    fontStyle: "italic",
    paddingTop: 4,
  },

  /* Energy card */
  energyCard: {
    marginBottom: 22,
    overflow: "hidden",
  },
  energyBgImage: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "65%",
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
  quoteSpan: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.display,
    fontSize: 26,
    lineHeight: 22,
  },
  quoteText: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 16,
    lineHeight: 22,
    maxWidth: 170,
    paddingTop: 4,
  },

  /* Dream card */
  dreamCard: {
    marginBottom: 22,
    overflow: "hidden",
  },
  dreamBgImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.95,
  },
  dreamInner: {
    minHeight: 256,
    padding: 20,
    width: "100%",
  },
  dreamCopy: {
    width: "100%",
    alignSelf: "stretch",
  },
  dreamSub: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: -2,
    marginBottom: 12,
  },
  dreamInputCard: {
    alignSelf: "stretch",
    marginTop: 2,
    borderRadius: 22,
    maxHeight: HOME_DREAM_INPUT_H,
    overflow: "hidden",
  },
  dreamInput: {
    width: "100%",
    alignSelf: "stretch",
    height: HOME_DREAM_INPUT_H,
    maxHeight: HOME_DREAM_INPUT_H,
    backgroundColor: "transparent",
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dreamPromptRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  dreamPromptPill: {
    minHeight: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(246,240,255,0.14)",
    backgroundColor: "rgba(246,240,255,0.06)",
  },
  dreamPromptText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
  },
  dreamComingSoon: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },
  dreamCtaWrap: {
    alignSelf: "center",
    marginTop: 16,
  },
  /** Заблокировано: без общей opacity — только приглушённый градиент и типографика. */
  dreamCtaInactive: {
    shadowOpacity: 0.14,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  dreamCtaWide: {
    minWidth: 222,
    justifyContent: "center",
  },
  dreamCtaTextInactive: {
    color: "#D8CFDF",
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

  ritualsRowScroll: {
    marginBottom: 4,
  },
  ritualsRowContent: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    paddingRight: 8,
  },
  dailyQuoteCard: {
    marginTop: 16,
    marginBottom: 22,
    overflow: "hidden",
    minHeight: 132,
  },
  dailyQuoteBgImage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    opacity: 0.85,
  },
  dailyQuoteGradient: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  dailyQuoteInner: {
    position: "relative",
    zIndex: 2,
    paddingHorizontal: 22,
    paddingVertical: 22,
  },
  dailyQuoteQuoteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 4,
  },
  dailyQuoteBodyCol: {
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  dailyQuoteMarkImage: {
    width: 72,
    aspectRatio: 1,
    marginTop: 2,
    opacity: 0.92,
  },
  dailyQuoteMarkImageFlip: {
    transform: [{ scaleX: -1 }],
  },
  dailyQuoteText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 22,
    lineHeight: 26,
    fontStyle: "italic",
    paddingTop: 2,
  },
  dailyQuoteAuthor: {
    width: "100%",
    flexShrink: 1,
    color: theme.colors.gold,
    fontFamily: theme.fonts.headingItalic,
    fontSize: 16,
    lineHeight: 16,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  ritualPressable: {
    borderRadius: 26,
    shadowColor: "#05030D",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.38,
    shadowRadius: 22,
    elevation: 11,
  },
  ritualPressAnim: {
    borderRadius: 26,
  },
  ritualAppearWrap: {
    borderRadius: 26,
    overflow: "hidden",
  },
  ritualCardClip: {
    aspectRatio: 4 / 5,
    width: "100%",
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#1a1428",
  },
  /** Дополнительное затемнение только в нижней зоне под текстом */
  ritualTextBandGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "46%",
    zIndex: 1,
  },
  ritualCardFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 28,
    paddingBottom: 18,
    alignItems: "center",
    zIndex: 2,
    gap: 8,
  },
  ritualTitleImg: {
    color: "#FFFFFF",
    fontFamily: theme.fonts.heading,
    fontSize: 21,
    lineHeight: 24,
    letterSpacing: 3.2,
    textAlign: "center",
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.58)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 14,
  },
  ritualSubImg: {
    color: "rgba(255,255,255,0.96)",
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.25,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
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
