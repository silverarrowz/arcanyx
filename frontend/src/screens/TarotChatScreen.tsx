import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { ArrowLeft, ArrowRight, ArrowUp, Coins, Heart, Sparkles, TrendingUp, Users } from "lucide-react-native";
import { theme } from "../theme";
import ScreenHeading from "../components/ScreenHeading";
import CosmicBackground from "../components/CosmicBackground";
import GlassCard from "../components/GlassCard";
import TarotCard from "../components/TarotCard";
import ProModal from "../components/profile/ProModal";
import RemainPill from "../components/RemainPill";
import { TAROT_DECK } from "../data/tarotCards";
import { cardDetailed, cardShort, cardTitleRu } from "../data/tarotOrientation";
import {
  historicalSpreadFallback,
  type TarotSpread,
} from "../data/tarotSpreads";
import {
  HistoryItem,
  TarotChatMessage,
  TarotChatState,
  useHistory,
} from "../context/HistoryContext";
import { useUser } from "../context/UserContext";
import { useTarotSpreads } from "../context/TarotSpreadsContext";
import { ApiError } from "../services/api";
import {
  TAROT_CHAT_MAX_FOLLOWUPS,
  TAROT_CHAT_QUESTION_MAX_LENGTH,
  TAROT_CHAT_TOPICS,
  canOpenTarotInterpret,
  defaultTopicForSpread,
  followupTarotChat,
  getTarotInterpretQuota,
  startTarotChat,
  type TarotChatCardPayload,
} from "../services/tarotChat";

type Props = {
  historyId?: string;
};

const TOPIC_ICONS: Record<
  (typeof TAROT_CHAT_TOPICS)[number],
  typeof Sparkles
> = {
  Ситуация: Sparkles,
  Любовь: Heart,
  Карьера: TrendingUp,
  Отношения: Users,
  Финансы: Coins,
};

function cardsPayloadFromItem(
  item: HistoryItem,
  spread: TarotSpread,
): TarotChatCardPayload[] {
  if (item.cardsSnapshot && item.cardsSnapshot.length > 0) {
    return item.cardsSnapshot.map((snap, index) => {
      const card = TAROT_DECK.find((entry) => entry.id === snap.cardId);
      const position = spread.positions[index];
      const reversed = snap.reversed === true;
      return {
        positionId: snap.positionId || position?.id || `pos-${index}`,
        positionLabelRu: snap.positionLabelRu || position?.labelRu || "Карта",
        cardId: snap.cardId,
        cardName: card
          ? cardTitleRu(card, reversed)
          : snap.cardName || "Карта",
        short: card ? cardShort(card, reversed) : "",
        detailed: card ? cardDetailed(card, reversed) : "",
        reversed,
      };
    });
  }

  if (item.cardId) {
    const card = TAROT_DECK.find((entry) => entry.id === item.cardId);
    const position = spread.positions[0];
    const reversed = item.cardReversed === true;
    return [
      {
        positionId: position?.id ?? "answer",
        positionLabelRu: position?.labelRu ?? "Ответ",
        cardId: item.cardId,
        cardName: card
          ? cardTitleRu(card, reversed)
          : item.cardName || "Карта",
        short: card ? cardShort(card, reversed) : "",
        detailed: card ? cardDetailed(card, reversed) : "",
        reversed,
      },
    ];
  }

  return [];
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Не удалось получить толкование. Попробуйте ещё раз.";
}

export default function TarotChatScreen({ historyId }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { items, hydrated, updateItem } = useHistory();
  const { isPro } = useUser();
  const { getSpreadById } = useTarotSpreads();
  const scrollRef = useRef<ScrollView>(null);
  const questionAnchorRef = useRef<View>(null);
  const scrollYRef = useRef(0);
  const questionFocusedRef = useRef(false);

  const item = useMemo(
    () =>
      typeof historyId === "string"
        ? items.find((entry) => entry.id === historyId && entry.type === "tarot")
        : undefined,
    [historyId, items],
  );

  const spread = useMemo(() => {
    const requestedId =
      item?.spread ??
      (item?.cardsSnapshot && item.cardsSnapshot.length > 1
        ? "three-situation"
        : "one-card");
    const catalogSpread = getSpreadById(requestedId);
    if (!item?.cardsSnapshot?.length) return catalogSpread;
    return (
      historicalSpreadFallback(
        requestedId === "three-card" ? "three-situation" : requestedId,
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
      ) ?? catalogSpread
    );
  }, [getSpreadById, item]);

  const cards = useMemo(
    () => (item ? cardsPayloadFromItem(item, spread) : []),
    [item, spread],
  );

  const [phase, setPhase] = useState<"compose" | "chat">("compose");
  const [topic, setTopic] = useState<string | undefined>();
  const [question, setQuestion] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<TarotChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [followupsUsed, setFollowupsUsed] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proVisible, setProVisible] = useState(false);
  const hydratedChatRef = useRef(false);

  const remaining = Math.max(0, TAROT_CHAT_MAX_FOLLOWUPS - followupsUsed);
  const interpretQuota = useMemo(
    () => getTarotInterpretQuota({ isPro, items }),
    [isPro, items],
  );
  const chatAlreadyStarted = Boolean(item?.tarotChat?.conversationId);
  const canStartNewInterpret = canOpenTarotInterpret({
    isPro,
    items,
    chatAlreadyStarted,
  });

  useEffect(() => {
    hydratedChatRef.current = false;
  }, [historyId]);

  useEffect(() => {
    if (!item || hydratedChatRef.current) return;
    hydratedChatRef.current = true;

    const saved = item.tarotChat;
    if (saved?.conversationId && saved.messages.length > 0) {
      setPhase("chat");
      setConversationId(saved.conversationId);
      setMessages(saved.messages);
      setFollowupsUsed(saved.followupsUsed ?? 0);
      setTopic(saved.topic);
      setQuestion(saved.question);
      return;
    }

    setTopic(item.tarotChat?.topic ?? defaultTopicForSpread(item.spread));
    setQuestion(item.intent?.trim() ?? item.tarotChat?.question ?? "");
  }, [item]);

  const persistChat = useCallback(
    (patch: TarotChatState) => {
      if (!item) return;
      updateItem(item.id, {
        intent: patch.question,
        tarotChat: patch,
      });
    },
    [item, updateItem],
  );

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/gadania?tab=tarot" as never);
  }, [router]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const scrollQuestionIntoView = useCallback(() => {
    const scroll = scrollRef.current;
    const anchor = questionAnchorRef.current;
    if (!scroll || !anchor) return;
    anchor.measureInWindow((_x, inputY) => {
      scroll.measureInWindow((_sx, scrollY) => {
        const delta = inputY - scrollY - 20;
        if (Math.abs(delta) < 8) return;
        scroll.scrollTo({
          y: Math.max(0, scrollYRef.current + delta),
          animated: true,
        });
      });
    });
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => {
      if (!questionFocusedRef.current) return;
      requestAnimationFrame(scrollQuestionIntoView);
    });
    return () => show.remove();
  }, [scrollQuestionIntoView]);

  const handleStart = useCallback(async () => {
    if (!item || sending) return;
    if (!canStartNewInterpret) {
      setProVisible(true);
      return;
    }
    const trimmed = question.trim();
    const selectedTopic = topic?.trim();
    if (!trimmed && !selectedTopic) {
      setError("Выберите сферу или введите вопрос.");
      return;
    }
    if (cards.length === 0) {
      setError("В раскладе нет карт.");
      return;
    }

    setError(null);
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const displayQuestion = trimmed || selectedTopic || "Расклад";
    const userMessage: TarotChatMessage = {
      role: "user",
      content: displayQuestion,
    };
    setMessages([userMessage]);
    setPhase("chat");
    scrollToEnd();

    try {
      const response = await startTarotChat({
        question: trimmed,
        topic: selectedTopic,
        spreadId: spread.id,
        spreadTitleRu: item.spreadLabelRu || spread.titleRu,
        cards,
      });
      const nextMessages: TarotChatMessage[] = [
        userMessage,
        { role: "assistant", content: response.reply },
      ];
      setConversationId(response.conversationId);
      setFollowupsUsed(response.followupsUsed);
      setMessages(nextMessages);
      persistChat({
        conversationId: response.conversationId,
        topic: selectedTopic,
        question: displayQuestion,
        followupsUsed: response.followupsUsed,
        messages: nextMessages,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    } catch (err) {
      setMessages([]);
      setPhase("compose");
      setError(errorMessage(err));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
    } finally {
      setSending(false);
      scrollToEnd();
    }
  }, [
    canStartNewInterpret,
    cards,
    item,
    persistChat,
    question,
    scrollToEnd,
    sending,
    spread.id,
    spread.titleRu,
    topic,
  ]);

  const handleFollowup = useCallback(async () => {
    if (!item || sending) return;
    if (!conversationId) return;

    if (remaining <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
      setProVisible(true);
      return;
    }

    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Введите уточнение.");
      return;
    }

    setError(null);
    setSending(true);
    setDraft("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const userMessage: TarotChatMessage = { role: "user", content: trimmed };
    const pending = [...messages, userMessage];
    setMessages(pending);
    scrollToEnd();

    try {
      const response = await followupTarotChat({
        conversationId,
        message: trimmed,
      });
      const nextMessages: TarotChatMessage[] = [
        ...pending,
        { role: "assistant", content: response.reply },
      ];
      setConversationId(response.conversationId);
      setFollowupsUsed(response.followupsUsed);
      setMessages(nextMessages);
      persistChat({
        conversationId: response.conversationId,
        topic,
        question: question.trim() || item.tarotChat?.question || trimmed,
        followupsUsed: response.followupsUsed,
        messages: nextMessages,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setFollowupsUsed(TAROT_CHAT_MAX_FOLLOWUPS);
        persistChat({
          conversationId,
          topic,
          question: question.trim() || item.tarotChat?.question || trimmed,
          followupsUsed: TAROT_CHAT_MAX_FOLLOWUPS,
          messages: pending,
        });
      } else {
        setMessages(messages);
        setDraft(trimmed);
        setError(errorMessage(err));
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
    } finally {
      setSending(false);
      scrollToEnd();
    }
  }, [
    conversationId,
    draft,
    item,
    messages,
    persistChat,
    question,
    remaining,
    scrollToEnd,
    sending,
    topic,
  ]);

  const cardCount = cards.length;
  const cardsPerRow =
    cardCount >= 5 ? 3 : cardCount === 4 ? 2 : Math.max(1, cardCount);
  const cardGap = cardCount >= 4 ? 8 : 12;
  const cardColWidth =
    cardCount <= 1
      ? undefined
      : (windowWidth - 36 - cardGap * (cardsPerRow - 1)) / cardsPerRow;
  const cardWidth =
    cardCount <= 1
      ? 96
      : Math.min(
          cardCount <= 3 ? 86 : 76,
          Math.max(64, (cardColWidth ?? 86) - 8),
        );
  const cardHeight = Math.round(cardWidth * 1.54);

  if (!hydrated) {
    return (
      <View style={styles.root}>
        <CosmicBackground />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.root}>
        <CosmicBackground />
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <Pressable onPress={handleBack} style={styles.backRow}>
            <ArrowLeft color={theme.colors.textDim} size={20} />
            <Text style={styles.backLabel}>Назад</Text>
          </Pressable>
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Расклад не найден</Text>
            <Text style={styles.emptyText}>
              Вернитесь к таро и сделайте новый расклад.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const ctaDisabled =
    sending ||
    (question.trim().length === 0 && !topic?.trim()) ||
    !canStartNewInterpret;

  return (
    <View style={styles.root} testID="tarot-chat-root">
      <CosmicBackground />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <View style={styles.topBar}>
            <Pressable
              onPress={handleBack}
              testID="tarot-chat-back"
              style={({ pressed }) => [
                styles.backRow,
                pressed && { opacity: 0.82 },
              ]}
            >
              <ArrowLeft color={theme.colors.textDim} size={20} />
              <Text style={styles.backLabel}>Назад</Text>
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(event) => {
              scrollYRef.current = event.nativeEvent.contentOffset.y;
            }}
            onContentSizeChange={phase === "chat" ? scrollToEnd : undefined}
          >
            <ScreenHeading
              title={item.spreadLabelRu || spread.titleRu}
              size="md"
              animated={false}
              style={styles.heroCopy}
            />

            <View
              style={[
                styles.cardsRow,
                { gap: cardGap },
                cardCount >= 4 && styles.cardsRowWrap,
              ]}
            >
              {cards.map((card, index) => {
                const deckCard = TAROT_DECK.find((entry) => entry.id === card.cardId);
                if (!deckCard) return null;
                return (
                  <View
                    key={`${card.positionId}-${card.cardId}`}
                    style={[
                      styles.cardCol,
                      cardColWidth ? { width: cardColWidth } : null,
                    ]}
                  >
                    <Text style={styles.cardPosition} numberOfLines={2}>
                      {card.positionLabelRu}
                    </Text>
                    <TarotCard
                      card={deckCard}
                      reversed={card.reversed}
                      flipped
                      width={cardWidth}
                      height={cardHeight}
                      hideFrontText={cardCount > 1}
                      testID={`tarot-chat-card-${index}`}
                    />
                    <Text style={styles.cardName} numberOfLines={2}>
                      {card.cardName}
                    </Text>
                  </View>
                );
              })}
            </View>

            {phase === "compose" ? (
              <GlassCard
                borderColor={theme.colors.borderPurple}
                glow="purple"
                style={styles.composeCard}
              >
                <View style={styles.composeInner}>
                  <View style={styles.composeEyebrow}>
                    <Sparkles color={theme.colors.gold} size={14} />
                    <Text style={styles.composeEyebrowText}>Толкование</Text>
                  </View>
                  <Text style={styles.composeTitle}>Узнайте больше</Text>
                  <Text style={styles.composeHint}>
                   К какой теме относится ваш вопрос?
                  </Text>

                  <View style={styles.chipsWrap}>
                    {TAROT_CHAT_TOPICS.map((label) => {
                      const active = topic === label;
                      const Icon = TOPIC_ICONS[label];
                      return (
                        <Pressable
                          key={label}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setTopic((prev) => (prev === label ? undefined : label));
                          }}
                          testID={`tarot-chat-topic-${label}`}
                          style={({ pressed }) => [
                            styles.chipPress,
                            pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                          ]}
                        >
                          {active ? (
                            <LinearGradient
                              colors={["#C9A6F5", "#9D7CE6"]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.chip}
                            >
                              <Icon color="#FFF7EA" size={15} strokeWidth={2} />
                              <Text style={styles.chipTextActive}>{label}</Text>
                            </LinearGradient>
                          ) : (
                            <View style={[styles.chip, styles.chipIdle]}>
                              <Icon
                                color={theme.colors.purple}
                                size={15}
                                strokeWidth={1.8}
                              />
                              <Text style={styles.chipText}>{label}</Text>
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>

                  <View ref={questionAnchorRef}>
                    <TextInput
                      value={question}
                      onChangeText={(value) => {
                        setQuestion(value.slice(0, TAROT_CHAT_QUESTION_MAX_LENGTH));
                        if (error) setError(null);
                      }}
                      onFocus={() => {
                        questionFocusedRef.current = true;
                      }}
                      onBlur={() => {
                        questionFocusedRef.current = false;
                      }}
                      placeholder="О чём вы хотите спросить карты?"
                      placeholderTextColor={theme.colors.textMuted}
                      multiline
                      style={styles.questionInput}
                      testID="tarot-chat-question"
                    />
                  </View>

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  {!canStartNewInterpret ? (
                    <Pressable
                      onPress={() => setProVisible(true)}
                      style={styles.quotaLock}
                      testID="tarot-chat-quota-lock"
                    >
                      <Text style={styles.quotaLockText}>
                        Бесплатные толкования закончились. Pro откроет новые
                        диалоги.
                      </Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    onPress={
                      canStartNewInterpret
                        ? handleStart
                        : () => setProVisible(true)
                    }
                    disabled={sending || (canStartNewInterpret && ctaDisabled)}
                    testID="tarot-chat-start"
                    style={({ pressed }) => [
                      styles.ctaWrap,
                      pressed &&
                        !ctaDisabled && {
                          opacity: 0.9,
                          transform: [{ scale: 0.98 }],
                        },
                      canStartNewInterpret && ctaDisabled && { opacity: 0.55 },
                    ]}
                  >
                    <LinearGradient
                      colors={
                        canStartNewInterpret
                          ? theme.gradients.primaryCta
                          : theme.gradients.primaryCtaMuted
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.ctaGradient}
                    >
                      {sending ? (
                        <ActivityIndicator color="#FFF7EA" />
                      ) : (
                        <>
                          <Text style={styles.ctaText}>
                            {canStartNewInterpret
                              ? "Получить толкование"
                              : "Открыть Pro"}
                          </Text>
                          {canStartNewInterpret && !interpretQuota.unlimited ? (
                            <RemainPill
                              remaining={interpretQuota.remaining}
                              compact
                            />
                          ) : null}
                        </>
                      )}
                    </LinearGradient>
                  </Pressable>
                </View>
              </GlassCard>
            ) : (
              <View style={styles.thread}>
                {messages.map((message, index) => (
                  <View
                    key={`${message.role}-${index}`}
                    style={[
                      styles.bubble,
                      message.role === "user"
                        ? styles.bubbleUser
                        : styles.bubbleAssistant,
                    ]}
                  >
                    {message.role === "assistant" ? (
                      <Text style={styles.bubbleRole}>Толкователь</Text>
                    ) : null}
                    <Text
                      style={[
                        styles.bubbleText,
                        message.role === "user" && styles.bubbleTextUser,
                      ]}
                    >
                      {message.content}
                    </Text>
                  </View>
                ))}
                {sending ? (
                  <View style={[styles.bubble, styles.bubbleAssistant]}>
                    <Text style={styles.bubbleRole}>Толкователь</Text>
                    <Text style={styles.typingText}>Думаю над картами…</Text>
                  </View>
                ) : null}
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                {remaining <= 0 && !sending ? (
                  <GlassCard
                    borderColor={theme.colors.borderGold}
                    glow="gold"
                    style={styles.proUpsellCard}
                  >
                    <View style={styles.proUpsellInner}>
                      <Text style={styles.proUpsellEyebrow}>Диалог завершён</Text>
                      <Text style={styles.proUpsellText}>
                        {isPro
                          ? "Уточнения в этом раскладе закончились. Новый вопрос можно задать в следующем раскладе."
                          : "Бесплатные уточнения в этом раскладе закончились. Pro откроет более глубокий разговор с картами."}
                      </Text>
                      {!isPro ? (
                        <Pressable
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setProVisible(true);
                          }}
                          testID="tarot-chat-pro-cta"
                          style={({ pressed }) => [
                            styles.ctaWrap,
                            pressed && {
                              opacity: 0.9,
                              transform: [{ scale: 0.98 }],
                            },
                          ]}
                        >
                          <LinearGradient
                            colors={theme.gradients.primaryCta}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.proUpsellCta}
                          >
                            <Text style={styles.ctaText}>Оформить Pro</Text>
                            <ArrowRight
                              color="#FFF7EA"
                              size={16}
                              strokeWidth={1.6}
                            />
                          </LinearGradient>
                        </Pressable>
                      ) : null}
                    </View>
                  </GlassCard>
                ) : null}
              </View>
            )}
          </ScrollView>

          {phase === "chat" && (remaining > 0 || sending) ? (
            <View
              style={[
                styles.composer,
                { paddingBottom: Math.max(insets.bottom, 8) },
              ]}
            >
              <View style={styles.inputRow}>
                <TextInput
                  value={draft}
                  onChangeText={(value) => {
                    setDraft(value.slice(0, TAROT_CHAT_QUESTION_MAX_LENGTH));
                    if (error) setError(null);
                  }}
                  placeholder="Уточните вопрос…"
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                  editable={!sending && Boolean(conversationId)}
                  style={styles.followupInput}
                  testID="tarot-chat-followup"
                />
                <Pressable
                  onPress={handleFollowup}
                  disabled={sending || draft.trim().length === 0 || !conversationId}
                  testID="tarot-chat-send"
                  style={({ pressed }) => [
                    styles.sendBtn,
                    pressed && { opacity: 0.88 },
                    (sending || draft.trim().length === 0 || !conversationId) && {
                      opacity: 0.45,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={theme.gradients.primaryCta}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.sendGradient}
                  >
                    <ArrowUp color="#FFF7EA" size={18} strokeWidth={2.4} />
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
      <ProModal visible={proVisible} onClose={() => setProVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  flex: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backLabel: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 14,
  },
  heroCopy: {
    paddingTop: 4,
    paddingBottom: 6,
  },
  heroDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "stretch",
    paddingHorizontal: 8,
  },
  heroDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(232, 201, 138, 0.28)",
  },
  heroDividerStar: {
    color: theme.colors.gold,
    fontSize: 11,
  },
  heroTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    fontSize: 30,
    lineHeight: 36,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 36,
    gap: 20,
  },
  cardsRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingTop: 2,
  },
  cardsRowWrap: {
    flexWrap: "wrap",
  },
  cardCol: {
    alignItems: "center",
    gap: 6,
  },
  cardPosition: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    textAlign: "center",
  },
  cardName: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    textAlign: "center",
  },
  composeCard: {
    width: "100%",
  },
  composeInner: {
    padding: 18,
    gap: 12,
  },
  composeEyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  composeEyebrowText: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  composeTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    fontSize: 26,
  },
  composeHint: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chipPress: {
    flexGrow: 1,
    flexBasis: "46%",
    minWidth: "46%",
    maxWidth: "48%",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  chipIdle: {
    backgroundColor: "rgba(157,124,230,0.18)",
  },
  chipText: {
    color: theme.colors.lilac,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
  },
  chipTextActive: {
    color: "#FFF7EA",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
  },
  questionInput: {
    minHeight: 88,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(18,16,34,0.55)",
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  ctaWrap: {
    borderRadius: 999,
    overflow: "hidden",
    ...theme.shadows.ctaPrimary,
  },
  ctaGradient: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 18,
    paddingRight: 10,
  },
  ctaText: {
    color: "#FFF7EA",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 15,
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  quotaLock: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    backgroundColor: theme.colors.goldSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quotaLockText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  proUpsellCard: {
    alignSelf: "stretch",
    marginTop: 4,
  },
  proUpsellInner: {
    padding: 18,
    gap: 10,
  },
  proUpsellEyebrow: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  proUpsellText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 21,
  },
  proUpsellCta: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  thread: {
    gap: 12,
    paddingBottom: 8,
  },
  bubble: {
    maxWidth: "92%",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(157,124,230,0.28)",
    borderWidth: 1,
    borderColor: theme.colors.borderPurple,
  },
  bubbleAssistant: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(35,31,58,0.82)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bubbleRole: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  bubbleText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: theme.colors.text,
  },
  typingText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodyMedium,
    fontStyle: "italic",
    fontSize: 14,
  },
  composer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: "rgba(18,16,34,0.92)",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  followupInput: {
    flex: 1,
    maxHeight: 96,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(35,31,58,0.72)",
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: "hidden",
  },
  sendGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 8,
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
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
