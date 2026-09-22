import React, { useMemo, useRef, useState } from "react";
import { useRemountOnTabFocus } from "../../src/hooks/useRemountOnTabFocus";
import {
  Alert,
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  type ImageSourcePropType,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useScrollToTop } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Eye,
  Layers,
  Sparkles,
  XCircle,
  CloudMoon,
  X,
  Feather,
  Menu,
  Crown,
  Pencil,
  Check,
  LogIn,
  Trash2,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { theme } from "../../src/theme";
import CosmicBackground from "../../src/components/CosmicBackground";
import SettingsModal from "../../src/components/profile/SettingsModal";
import ProModal from "../../src/components/profile/ProModal";
import LoginModal from "../../src/components/profile/LoginModal";
import GoldSheetRim from "../../src/components/profile/GoldSheetRim";
import EditorialMasthead from "../../src/components/EditorialMasthead";
import { monthNominative, plural } from "../../src/utils/plural";
import { HistoryItem, useHistory } from "../../src/context/HistoryContext";
import { useUser } from "../../src/context/UserContext";
import { frontArtSourceForCardId } from "../../src/data/tarotFrontArt";

const ORACLE_ART = require("../../assets/home/chrome-ball.jpg");
const TAROT_CARD_BACK = require("../../assets/tarot/card-back2.png");
const DREAM_ART = require("../../assets/home/chrome-dreams.jpg");
const NOTE_ART = require("../../assets/home/chrome-aff.jpg");
const DIARY_ICON = require("../../assets/icons/icon-diary2.png");

type DiaryFilter = "all" | "oracle" | "tarot" | "dream" | "note";

type DiarySection = {
  title: string;
  key: string;
  data: HistoryItem[];
};

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDayTitle(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (sameDay) return "Сегодня";
  if (isYesterday) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function tarotCardIds(item: HistoryItem): string[] {
  if (item.cardsSnapshot && item.cardsSnapshot.length > 0) {
    return item.cardsSnapshot.map((c) => c.cardId);
  }
  return item.cardId ? [item.cardId] : [];
}

function entryArtSource(item: HistoryItem): ImageSourcePropType {
  if (item.type === "dream") {
    if (item.dreamImageUrl) return { uri: item.dreamImageUrl };
    return DREAM_ART;
  }
  if (item.type === "note") return NOTE_ART;
  if (item.type === "oracle") return ORACLE_ART;
  const ids = tarotCardIds(item);
  return ids.length > 0 ? frontArtSourceForCardId(ids[0]) : TAROT_CARD_BACK;
}

function entrySurfaceColor(item: HistoryItem): string {
  if (item.type === "dream") return "#2A364E";
  if (item.type === "note") return "#1E3A5F";
  if (item.type === "oracle") return "#483062";
  return "#3A2E48";
}

function EntryFade({ color }: { color: string }) {
  return (
    <LinearGradient
      colors={[
        color,
        color,
        `${color}F0`,
        `${color}BF`,
        `${color}7A`,
        `${color}38`,
        `${color}00`,
      ]}
      locations={[0, 0.48, 0.56, 0.68, 0.8, 0.9, 1]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={styles.entryFade}
      pointerEvents="none"
    />
  );
}

function DiaryRow({ item, index }: { item: HistoryItem; index: number }) {
  const { setOutcome, removeItem } = useHistory();
  const router = useRouter();

  const isOracle = item.type === "oracle";
  const isDream = item.type === "dream";
  const isTarot = item.type === "tarot";
  const isNote = item.type === "note";

  const handleOutcome = (outcome: "fulfilled" | "failed") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setOutcome(item.id, item.outcome === outcome ? null : outcome);
  };

  const handleDelete = () => {
    Alert.alert(
      "Удалить запись?",
      "Восстановить её после удаления не получится.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning,
            ).catch(() => {});
            removeItem(item.id);
          },
        },
      ],
    );
  };

  const openEntry = () => {
    Haptics.selectionAsync().catch(() => {});

    if (isNote) {
      router.push(`/note-reading?id=${encodeURIComponent(item.id)}` as never);
      return;
    }

    const encodedId = encodeURIComponent(item.id);
    if (isTarot) {
      router.push(`/tarot-reading?id=${encodedId}` as never);
    } else if (isOracle) {
      router.push(`/oracle-reading?id=${encodedId}` as never);
    } else if (isDream) {
      router.push(`/dream-result?id=${encodedId}` as never);
    }
  };

  const accent = isDream
    ? "#9AA2E6"
    : isNote
    ? "#38BDF8"
    : isOracle
    ? theme.colors.mauve
    : theme.colors.gold;

  const borderColor = isDream
    ? "rgba(154,162,230,0.4)"
    : isNote
    ? "rgba(56,189,248,0.4)"
    : isOracle
    ? theme.colors.borderPurple
    : theme.colors.borderGold;

  return (
    <Animated.View
      entering={FadeInDown.duration(420).delay(Math.min(index, 5) * 45)}
      style={styles.rowWrap}
    >
      {/* Timeline connection */}
      <View style={styles.timelineWrap}>
        <View style={[styles.timelineLine, { backgroundColor: borderColor }]} />
        <View style={[styles.timelineDot, { backgroundColor: accent, shadowColor: accent }]} />
      </View>

      <View
        style={[
          styles.row,
          {
            borderColor,
            backgroundColor: entrySurfaceColor(item),
          },
          isOracle || isDream || isNote
            ? styles.rowGlowPurple
            : styles.rowGlowGold,
        ]}
      >
        <Image
          source={entryArtSource(item)}
          style={styles.entryArt}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <EntryFade color={entrySurfaceColor(item)} />
        <Pressable
          onPress={openEntry}
          testID={`diary-row-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Открыть запись: ${item.question || item.dreamText}`}
          style={({ pressed }) => [
            styles.rowInner,
            pressed && { opacity: 0.92 },
          ]}
        >
          <View style={styles.rowBody}>
            <View style={styles.rowHeader}>
              <View
                style={[
                  styles.typeBadge,
                  {
                    borderColor: isDream
                        ? "rgba(154,162,230,0.3)"
                        : isNote
                        ? "rgba(56,189,248,0.3)"
                        : isOracle
                        ? "rgba(196,123,234,0.45)"
                        : "rgba(255,215,154,0.42)",
                    backgroundColor: isDream
                        ? "rgba(154,162,230,0.12)"
                        : isNote
                        ? "rgba(56,189,248,0.12)"
                        : isOracle
                        ? "rgba(196,123,234,0.14)"
                        : "rgba(255,215,154,0.12)",
                  },
                ]}
              >
                {isDream ? (
                  <CloudMoon color={accent} size={11} strokeWidth={1.8} />
                ) : isNote ? (
                  <Feather color={accent} size={11} strokeWidth={1.8} />
                ) : isOracle ? (
                  <Eye color={accent} size={11} strokeWidth={1.8} />
                ) : (
                  <Layers color={accent} size={11} strokeWidth={1.8} />
                )}
                <Text style={[styles.typeText, { color: accent }]}>
                  {isDream ? "Сон" : isNote ? "Заметка" : isOracle ? "Оракул" : "Таро"}
                </Text>
              </View>

            </View>

            {isNote ? null : (
              <Text style={styles.question} numberOfLines={2}>
                {isDream ? (item.dreamText || "Без описания") : item.question}
              </Text>
            )}

            <Text style={[styles.answer, isNote && { opacity: 1, marginTop: 4 }]} numberOfLines={3}>
              {isNote ? item.answer : `«${item.answer}»`}
            </Text>

            {item.userInterpretation ? (
              <Text style={styles.interpretationSnippet} numberOfLines={2}>
                Моё толкование: {item.userInterpretation}
              </Text>
            ) : null}

          </View>
        </Pressable>

        <Pressable
          onPress={handleDelete}
          hitSlop={8}
          testID={`delete-diary-row-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel="Удалить запись"
          style={({ pressed }) => [
            styles.deleteEntryButton,
            pressed && styles.deleteEntryButtonPressed,
          ]}
        >
          <Trash2 color={theme.colors.textDim} size={16} strokeWidth={1.7} />
        </Pressable>

        {isOracle ? (
          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => handleOutcome("fulfilled")}
              testID={`outcome-fulfilled-${item.id}`}
              style={[
                styles.actionBtn,
                item.outcome === "fulfilled" && styles.actionBtnActiveGreen,
              ]}
            >
              <CheckCircle2
                color={
                  item.outcome === "fulfilled"
                    ? theme.colors.success
                    : theme.colors.textDim
                }
                size={15}
                strokeWidth={1.7}
              />
              <Text
                style={[
                  styles.actionText,
                  item.outcome === "fulfilled" && { color: theme.colors.success },
                ]}
              >
                Сбылось
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleOutcome("failed")}
              testID={`outcome-failed-${item.id}`}
              style={[
                styles.actionBtn,
                item.outcome === "failed" && styles.actionBtnActiveRed,
              ]}
            >
              <XCircle
                color={
                  item.outcome === "failed"
                    ? theme.colors.danger
                    : theme.colors.textDim
                }
                size={15}
                strokeWidth={1.7}
              />
              <Text
                style={[
                  styles.actionText,
                  item.outcome === "failed" && { color: theme.colors.danger },
                ]}
              >
                Не сбылось
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

export default function DiaryScreen() {
  const { items, addItem, hydrated, syncing, streak } = useHistory();
  const {
    name,
    isPro,
    isAuthenticated,
    hydrated: userHydrated,
    setName,
  } = useUser();
  const displayName = isAuthenticated ? name : "Гость";
  const [isEditingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(name);
  const remountKey = useRemountOnTabFocus();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const listRef = useRef<SectionList<HistoryItem, DiarySection>>(null);
  useScrollToTop(listRef);
  const [filter, setFilter] = useState<DiaryFilter>("all");
  const [isNoteModalVisible, setNoteModalVisible] = useState(false);
  const [isMenuVisible, setMenuVisible] = useState(false);
  const [isProVisible, setProVisible] = useState(false);
  const [isLoginVisible, setLoginVisible] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSheetWidth, setNoteSheetWidth] = useState(0);

  const openNoteModal = () => {
    Haptics.selectionAsync().catch(() => {});
    setNoteText("");
    setNoteModalVisible(true);
  };

  const readings = useMemo(
    () =>
      [...items]
        .filter((item) => ["tarot", "dream", "note"].includes(item.type))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [items],
  );

  const stats = useMemo(() => {
    return {
      all: readings.length,
      tarot: readings.filter((i) => i.type === "tarot").length,
      dream: readings.filter((i) => i.type === "dream").length,
      note: readings.filter((i) => i.type === "note").length,
    };
  }, [readings]);

  /** Masthead counts: the totals, plus the streak the context already tracks. */
  const archiveStats = useMemo(
    () => [
      {
        value: stats.all,
        label: plural(stats.all, ["запись", "записи", "записей"]),
      },
      {
        value: streak,
        label: `${plural(streak, ["день", "дня", "дней"])} подряд`,
      },
    ],
    [stats.all, streak],
  );

  const FILTERS: { id: DiaryFilter; label: string; count: number }[] = [
    { id: "all", label: "Все", count: stats.all },
    { id: "tarot", label: "Таро", count: stats.tarot },
    { id: "dream", label: "Сны", count: stats.dream },
    { id: "note", label: "Заметки", count: stats.note },
  ];

  const sections = useMemo<DiarySection[]>(() => {
    const filtered = filter === "all" ? readings : readings.filter((i) => i.type === filter);
    const groups = new Map<string, HistoryItem[]>();
    for (const item of filtered) {
      const key = dayKey(item.date);
      const list = groups.get(key);
      if (list) list.push(item);
      else groups.set(key, [item]);
    }
    return [...groups.entries()].map(([key, data]) => ({
      key,
      title: formatDayTitle(data[0].date),
      data,
    }));
  }, [filter, readings]);

  const selectFilter = (id: DiaryFilter) => {
    if (id === filter) return;
    Haptics.selectionAsync().catch(() => {});
    setFilter(id);
  };

  const openProfileMenu = () => {
    Haptics.selectionAsync().catch(() => {});
    setMenuVisible(true);
  };

  const startEditName = () => {
    Haptics.selectionAsync().catch(() => {});
    setNameDraft(name);
    setEditingName(true);
  };

  const cancelEditName = () => {
    Keyboard.dismiss();
    setNameDraft(name);
    setEditingName(false);
  };

  const saveEditName = () => {
    const next = nameDraft.trim();
    if (!next) return;
    setName(next.slice(0, 80));
    Keyboard.dismiss();
    setEditingName(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const listHeader = (
    <View style={styles.headerArea}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable
          onPress={openProfileMenu}
          hitSlop={8}
          testID="profile-menu-btn"
          accessibilityRole="button"
          accessibilityLabel="Открыть меню профиля"
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.82 }]}
        >
          <Menu color={theme.colors.text} size={20} strokeWidth={1.8} />
        </Pressable>
        <View style={styles.topBarSpacer} />
        <View style={styles.accountBadge}>
          <Crown color={isPro ? theme.colors.gold : theme.colors.textDim} size={13} />
          <Text style={[styles.accountBadgeText, isPro && { color: theme.colors.gold }]}>
            {isPro ? "PRO" : "FREE"}
          </Text>
        </View>
      </View>

      <View style={styles.profileHero}>
        <Text style={styles.profileEyebrow}>МОЙ ПРОФИЛЬ</Text>
        {isAuthenticated && isEditingName ? (
          <View style={styles.profileNameEdit}>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              onSubmitEditing={saveEditName}
              autoFocus
              maxLength={80}
              returnKeyType="done"
              autoCorrect={false}
              autoCapitalize="words"
              placeholder="Ваше имя"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.profileNameInput}
              testID="profile-name-input"
              accessibilityLabel="Имя в профиле"
            />
            <Pressable
              onPress={saveEditName}
              disabled={!nameDraft.trim()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Сохранить имя"
              style={({ pressed }) => [
                styles.profileNameAction,
                (!nameDraft.trim() || pressed) && { opacity: 0.7 },
              ]}
            >
              <Check color={theme.colors.gold} size={18} strokeWidth={2.2} />
            </Pressable>
            <Pressable
              onPress={cancelEditName}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Отменить изменение имени"
              style={({ pressed }) => [styles.profileNameAction, pressed && { opacity: 0.7 }]}
            >
              <X color={theme.colors.textMuted} size={18} strokeWidth={1.8} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.profileNameRow}>
            <View style={styles.profileNameSide} />
            {isAuthenticated ? (
              <Text style={styles.profileName} testID="profile-name">
                {displayName}
              </Text>
            ) : (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setLoginVisible(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Войти в аккаунт"
              >
                <Text style={styles.profileName} testID="profile-name">
                  {displayName}
                </Text>
              </Pressable>
            )}
            {isAuthenticated ? (
              <Pressable
                onPress={startEditName}
                hitSlop={10}
                testID="profile-edit-name-btn"
                accessibilityRole="button"
                accessibilityLabel="Изменить имя"
                style={({ pressed }) => [styles.profileEditNameBtn, pressed && { opacity: 0.78 }]}
              >
                <Pencil color={theme.colors.textDim} size={16} strokeWidth={1.8} />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setLoginVisible(true);
                }}
                hitSlop={10}
                testID="profile-login-btn"
                accessibilityRole="button"
                accessibilityLabel="Войти"
                style={({ pressed }) => [styles.profileEditNameBtn, pressed && { opacity: 0.78 }]}
              >
                <LogIn color={theme.colors.textDim} size={18} strokeWidth={1.8} />
              </Pressable>
            )}
          </View>
        )}
        <Text style={styles.profileSubtitle}>
          Ваше личное пространство для знаков, снов и внутренней ясности
        </Text>

        {!isPro ? (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setProVisible(true);
            }}
            style={({ pressed }) => [styles.proButton, pressed && { opacity: 0.88 }]}
            testID="profile-pro-btn"
            accessibilityRole="button"
            accessibilityLabel="Перейти на Pro"
          >
            <LinearGradient
              colors={theme.gradients.primaryCta}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.proButtonGradient}
            >
              <Crown color="#FFF7EA" size={16} strokeWidth={1.8} />
              <Text style={styles.proButtonText}>Перейти на Pro</Text>
            </LinearGradient>
          </Pressable>
        ) : null}

      </View>

      <EditorialMasthead
        eyebrow={`ДНЕВНИК · ${monthNominative(new Date()).toUpperCase()} ${new Date().getFullYear()}`}
        lead="Всё, что уже"
        accent="отозвалось в вас."
        deck="Расклады, сны и заметки собираются здесь сами. Возвращайтесь к тому, что важно, и замечайте повторяющиеся образы."
        deckIllustration={DIARY_ICON}
        stats={archiveStats}
      />

      <View style={styles.diaryActionRow}>
        <Pressable
          style={({ pressed }) => [styles.createNoteBtn, pressed && { opacity: 0.85 }]}
          onPress={() => openNoteModal()}
        >
          <Pencil color={theme.colors.archive.headline} size={15} strokeWidth={1.8} />
          <Text style={styles.createNoteText}>Сделать запись</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersScroll}
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => selectFilter(f.id)}
              testID={`diary-filter-${f.id}`}
              style={({ pressed }) => [
                styles.filterPill,
                active && styles.filterPillActive,
                pressed && { opacity: 0.8 },
              ]}
            >
              {active ? (
                <LinearGradient
                  colors={["rgba(239,160,192,0.45)", "rgba(157,124,230,0.28)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                {f.label}
              </Text>
              <View style={[styles.filterBadge, active && styles.filterBadgeActive]}>
                <Text style={[styles.filterBadgeText, active && styles.filterBadgeTextActive]}>
                  {f.count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const historyPending =
    !hydrated ||
    !userHydrated ||
    (isAuthenticated && syncing && readings.length === 0);

  const empty = (
    <View style={styles.empty}>
      <View style={styles.emptyMoon}>
        <LinearGradient
          colors={["rgba(157,124,230,0.4)", "rgba(35,31,58,0.92)"]}
          style={StyleSheet.absoluteFill}
        />
        {historyPending ? (
          <ActivityIndicator color={theme.colors.gold} />
        ) : readings.length === 0 ? (
          <BookOpen color={theme.colors.gold} size={28} strokeWidth={1.4} />
        ) : (
          <Sparkles color={theme.colors.gold} size={26} strokeWidth={1.5} />
        )}
      </View>
      <Text style={styles.emptyTitle}>
        {historyPending
          ? "Загружаем записи…"
          : readings.length === 0
            ? "Страницы ещё чисты"
            : "В этом разделе пока тихо"}
      </Text>
      <Text style={styles.emptyText}>
        {historyPending
          ? "Синхронизируем расклады, сны и заметки с аккаунтом."
          : readings.length === 0
            ? "Задайте вопрос Оракулу, вытяните карты Таро или растолкуйте сон."
            : "Попробуйте другой фильтр или сохраните новое гадание."}
      </Text>
      {!historyPending && readings.length === 0 ? (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.push("/(tabs)/gadania" as never);
          }}
          style={({ pressed }) => [
            styles.emptyCta,
            pressed && { opacity: 0.92 },
          ]}
        >
          <LinearGradient
            colors={theme.gradients.primaryCta}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.emptyCtaGradient}
          >
            <Text style={styles.emptyCtaText}>К гаданиям</Text>
            <ChevronRight color="#FFF7EA" size={16} strokeWidth={1.8} />
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );

  const handleSaveNote = () => {
    if (!noteText.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    addItem({
      type: "note",
      question: "Личная заметка",
      answer: noteText.trim(),
    });

    setNoteText("");
    setNoteModalVisible(false);
  };

  const closeNoteModal = () => {
    Keyboard.dismiss();
    setNoteModalVisible(false);
    setNoteText("");
  };

  return (
    <View style={styles.root}>
      <CosmicBackground variant="tarot" />

      <SectionList
        ref={listRef}
        key={String(remountKey)}
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <DiaryRow item={item} index={index} />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHeader}>
            <View style={styles.dayTimelineWrap}>
               <View style={styles.dayTimelineDot} />
               <View style={styles.dayTimelineLine} />
            </View>
            <View style={styles.dayHeaderContent}>
               <Text style={styles.dayHeaderTitle}>{section.title}</Text>
            </View>
          </View>
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        extraData={filter}
        testID="diary-list"
      />

      {/* Add Note Modal */}
      <Modal
        visible={isNoteModalVisible}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={closeNoteModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeNoteModal}
            accessibilityRole="button"
            accessibilityLabel="Закрыть окно заметки"
          />
          <View
            style={styles.modalContent}
            onLayout={(event) => setNoteSheetWidth(event.nativeEvent.layout.width)}
          >
            <GoldSheetRim
              width={noteSheetWidth}
              radius={30}
              idPrefix="noteSheetRim"
            />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Новая заметка</Text>
              <Pressable
                onPress={closeNoteModal}
                style={styles.modalCloseBtn}
                hitSlop={10}
              >
                <X color={theme.colors.textMuted} size={24} />
              </Pressable>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Что у вас на душе?"
              placeholderTextColor={theme.colors.textMuted}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              autoFocus
              textAlignVertical="top"
            />

            <Pressable
              style={({ pressed }) => [
                styles.modalSaveBtn,
                !noteText.trim() && styles.modalSaveBtnDisabled,
                pressed && { opacity: 0.8 },
              ]}
              disabled={!noteText.trim()}
              onPress={handleSaveNote}
            >
              <LinearGradient
                colors={noteText.trim() ? theme.gradients.primaryCta : ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.05)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modalSaveGradient}
              >
                <Text style={[styles.modalSaveText, !noteText.trim() && { color: theme.colors.textMuted }]}>
                  Сохранить
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <SettingsModal visible={isMenuVisible} onClose={() => setMenuVisible(false)} />
      <ProModal visible={isProVisible} onClose={() => setProVisible(false)} />
      <LoginModal visible={isLoginVisible} onClose={() => setLoginVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  listContent: {
    paddingBottom: 140,
  },

  /* Background */
  /* Header */
  headerArea: {
    paddingBottom: 10,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 0,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  topBarSpacer: {
    flex: 1,
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
  accountBadge: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "rgba(26,23,43,0.7)",
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  accountBadgeText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 1.4,
  },
  profileHero: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  profileEyebrow: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 2.6,
    marginBottom: 7,
  },
  profileNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "100%",
    gap: 4,
  },
  profileNameSide: {
    width: 36,
    height: 36,
  },
  profileName: {
    fontFamily: theme.fonts.display,
    color: theme.colors.text,
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: 0.5,
    textAlign: "center",
    flexShrink: 1,
  },
  profileEditNameBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  profileNameEdit: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: 8,
    paddingHorizontal: 8,
  },
  profileNameInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 8 : 6,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    backgroundColor: "rgba(26,23,43,0.72)",
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    fontSize: 24,
    textAlign: "center",
  },
  profileNameAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(35,31,58,0.55)",
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  profileSubtitle: {
    color: theme.colors.lilac,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 340,
    marginTop: 4,
    opacity: 0.94,
  },
  proButton: {
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 16,
    ...theme.shadows.ctaPrimary,
  },
  proButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 21,
    paddingVertical: 11,
  },
  proButtonText: {
    color: "#FFF7EA",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
  },
  diaryActionRow: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  createNoteBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.archive.rule,
  },
  createNoteText: {
    color: theme.colors.archive.headline,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },

  /* Filters */
  filtersScroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: "rgba(26,23,43,0.65)",
    overflow: "hidden",
  },
  filterPillActive: {
    borderColor: theme.colors.borderGold,
  },
  filterLabel: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
    color: theme.colors.textDim,
    marginRight: 8,
  },
  filterLabelActive: {
    color: theme.colors.text,
  },
  filterBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  filterBadgeActive: {
    backgroundColor: "rgba(26,23,43,0.4)",
  },
  filterBadgeText: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    color: theme.colors.textDim,
  },
  filterBadgeTextActive: {
    color: theme.colors.text,
  },

  /* Timeline List */
  dayHeader: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: 20,
  },
  dayTimelineWrap: {
    width: 24,
    alignItems: "center",
  },
  dayTimelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: theme.colors.borderStrong,
  },
  dayTimelineDot: {
    position: "absolute",
    top: 24,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.textDim,
    borderWidth: 2,
    borderColor: theme.colors.bg,
    zIndex: 2,
  },
  dayHeaderContent: {
    flex: 1,
    paddingTop: 20,
    paddingBottom: 12,
    paddingLeft: 12,
  },
  dayHeaderTitle: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  rowWrap: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  timelineWrap: {
    width: 24,
    alignItems: "center",
  },
  timelineLine: {
    position: "absolute",
    top: -16,
    bottom: -16,
    width: 2,
  },
  timelineDot: {
    marginTop: 28,
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    zIndex: 2,
  },
  row: {
    flex: 1,
    marginLeft: 12,
    overflow: "hidden",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    minHeight: 110,
    ...theme.shadows.card,
  },
  rowGlowPurple: {
    ...theme.shadows.glowPurple,
  },
  rowGlowGold: {
    ...theme.shadows.glowGold,
  },
  entryArt: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "62%",
  },
  entryFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  rowInner: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 110,
    position: "relative",
  },
  rowBody: {
    flex: 1,
    padding: 16,
    paddingRight: 40, /* leave some space on the right for image */
    zIndex: 2,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  typeText: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  deleteEntryButton: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 5,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(18,16,34,0.58)",
  },
  deleteEntryButtonPressed: {
    opacity: 0.68,
    transform: [{ scale: 0.94 }],
  },
  question: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 4,
  },
  answer: {
    color: theme.colors.lilac,
    fontFamily: theme.fonts.headingItalic,
    fontSize: 16,
    lineHeight: 21,
    marginBottom: 4,
    opacity: 0.92,
  },
  spreadMeta: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    marginTop: 4,
    opacity: 0.92,
  },
  interpretationSnippet: {
    color: theme.colors.mauve,
    fontFamily: theme.fonts.body,
    fontStyle: "italic",
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 6,
    opacity: 0.95,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  metaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  metaText: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10.5,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },

  actionsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
    marginTop: -2,
    zIndex: 2,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderPurple,
    backgroundColor: "rgba(35,31,58,0.55)",
  },
  actionBtnActiveGreen: {
    borderColor: "rgba(16,185,129,0.5)",
    backgroundColor: "rgba(16,185,129,0.12)",
  },
  actionBtnActiveRed: {
    borderColor: "rgba(239,68,68,0.5)",
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  actionText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
  },

  empty: {
    alignItems: "center",
    paddingTop: 36,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyMoon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    marginBottom: 6,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    fontSize: 22,
    textAlign: "center",
  },
  emptyText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
  emptyCta: {
    marginTop: 10,
    borderRadius: 999,
    overflow: "hidden",
    ...theme.shadows.ctaPrimary,
  },
  emptyCtaGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  emptyCtaText: {
    color: "#FFF7EA",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
    letterSpacing: 0.3,
  },

  /* Add Note Modal */
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(10, 8, 20, 0.75)",
  },
  modalContent: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: 40,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: 22,
    color: theme.colors.text,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalInput: {
    minHeight: 120,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 16,
    lineHeight: 24,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    marginBottom: 20,
    // @ts-ignore - web only
    outlineStyle: "none",
  },
  modalSaveBtn: {
    borderRadius: 999,
    overflow: "hidden",
  },
  modalSaveBtnDisabled: {
    opacity: 0.6,
  },
  modalSaveGradient: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSaveText: {
    color: "#FFF",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
