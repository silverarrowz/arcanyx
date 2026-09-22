import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Send,
} from "lucide-react-native";
import CosmicBackground from "../src/components/CosmicBackground";
import { useUser } from "../src/context/UserContext";
import {
  sendSupportRequest,
  type SupportCategory,
} from "../src/services/support";
import { theme } from "../src/theme";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MESSAGE_MAX_LENGTH = 3000;

const CATEGORIES: { id: SupportCategory; label: string }[] = [
  { id: "technical", label: "Техническая проблема" },
  { id: "account", label: "Аккаунт" },
  { id: "content", label: "Расклады и контент" },
  { id: "idea", label: "Идея или пожелание" },
  { id: "other", label: "Другое" },
];

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "password",
    question: "Как восстановить пароль?",
    answer:
      "Откройте «Войти», выберите «Забыли пароль?» и введите email. Мы пришлём код для создания нового пароля.",
  },
  {
    id: "history",
    question: "Как сохранить историю на другом устройстве?",
    answer:
      "Войдите в один и тот же аккаунт на обоих устройствах. История снов и раскладов синхронизируется с вашим профилем.",
  },
  {
    id: "notifications",
    question: "Как отключить уведомления?",
    answer:
      "Откройте «Настройки» и выключите переключатель «Уведомления». Там же их можно включить снова.",
  },
];

export default function SupportScreen() {
  const router = useRouter();
  const { email: profileEmail, token } = useUser();
  const [openFaqId, setOpenFaqId] = useState<string | null>(FAQ_ITEMS[0].id);
  const [category, setCategory] = useState<SupportCategory>("technical");
  const [email, setEmail] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const resolvedEmail = email ?? profileEmail ?? "";

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)" as never);
  };

  const validate = () => {
    const normalizedEmail = resolvedEmail.trim();
    const normalizedMessage = message.trim();

    if (!normalizedEmail) return "Введите email для ответа";
    if (!EMAIL_RE.test(normalizedEmail)) return "Проверьте email";
    if (normalizedMessage.length < 10) {
      return "Опишите вопрос чуть подробнее — минимум 10 символов";
    }
    return null;
  };

  const handleSubmit = async () => {
    if (sending) return;
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSending(true);
    setFormError(null);
    try {
      const result = await sendSupportRequest(
        { category, email: resolvedEmail, message },
        token,
      );
      setRequestId(result.id);
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Не удалось отправить обращение. Попробуйте ещё раз.",
      );
    } finally {
      setSending(false);
    }
  };

  const startAnotherRequest = () => {
    setCategory("technical");
    setMessage("");
    setFormError(null);
    setRequestId(null);
  };

  return (
    <View style={styles.root}>
      <CosmicBackground variant="tarot" />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            hitSlop={10}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Назад"
          >
            <ArrowLeft color={theme.colors.text} size={21} strokeWidth={1.8} />
          </Pressable>
          <Text style={styles.headerTitle}>Поддержка</Text>
          <View style={styles.headerSpacer} />
        </View>

        <KeyboardAvoidingView
          style={styles.keyboard}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
          >
            {requestId ? (
              <View style={styles.success}>
                <View style={styles.successIcon}>
                  <CheckCircle2
                    color={theme.colors.gold}
                    size={36}
                    strokeWidth={1.6}
                  />
                </View>
                <Text style={styles.successTitle}>Обращение отправлено</Text>
                <Text style={styles.subtitle}>
                  Мы получили ваше сообщение и ответим на указанный email.
                </Text>
                <Text style={styles.requestId}>
                  Номер обращения: {requestId.slice(-6).toUpperCase()}
                </Text>
                <Pressable
                  onPress={handleBack}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryButtonText}>Готово</Text>
                </Pressable>
                <Pressable
                  onPress={startAnotherRequest}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryButtonText}>
                    Отправить ещё одно
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.subtitle}>
                  Возможно, ответ уже есть ниже. Если нет — напишите нам.
                </Text>

                <Text style={styles.sectionTitle}>Написать нам</Text>
                <Text style={styles.fieldLabel}>Тема</Text>
                <View style={styles.categories}>
                  {CATEGORIES.map((item) => {
                    const selected = item.id === category;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => {
                          setCategory(item.id);
                          setFormError(null);
                        }}
                        style={({ pressed }) => [
                          styles.categoryChip,
                          selected && styles.categoryChipSelected,
                          pressed && styles.buttonPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text
                          style={[
                            styles.categoryText,
                            selected && styles.categoryTextSelected,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>Email для ответа</Text>
                <TextInput
                  value={resolvedEmail}
                  onChangeText={(value) => {
                    setEmail(value);
                    setFormError(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                  placeholder="you@example.com"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                  editable={!sending}
                  testID="support-email-input"
                />

                <View style={styles.messageLabelRow}>
                  <Text style={styles.fieldLabel}>Сообщение</Text>
                  <Text style={styles.counter}>
                    {message.length}/{MESSAGE_MAX_LENGTH}
                  </Text>
                </View>
                <TextInput
                  value={message}
                  onChangeText={(value) => {
                    setMessage(value);
                    setFormError(null);
                  }}
                  multiline
                  maxLength={MESSAGE_MAX_LENGTH}
                  placeholder="Расскажите, что произошло или чем мы можем помочь"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[styles.input, styles.messageInput]}
                  textAlignVertical="top"
                  editable={!sending}
                  testID="support-message-input"
                />

                {formError ? (
                  <Text style={styles.error} accessibilityRole="alert">
                    {formError}
                  </Text>
                ) : null}

                <Pressable
                  onPress={handleSubmit}
                  disabled={sending}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (pressed || sending) && styles.buttonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Отправить обращение"
                  testID="support-submit"
                >
                  {sending ? (
                    <ActivityIndicator color={theme.colors.text} />
                  ) : (
                    <>
                      <Send
                        color={theme.colors.text}
                        size={17}
                        strokeWidth={1.8}
                      />
                      <Text style={styles.primaryButtonText}>Отправить</Text>
                    </>
                  )}
                </Pressable>
                <Text style={styles.privacy}>
                  Email используется только для ответа на ваше обращение.
                </Text>

                <Text style={[styles.sectionTitle, styles.faqTitle]}>
                  Частые вопросы
                </Text>
                <View style={styles.faqList}>
                  {FAQ_ITEMS.map((item, index) => {
                    const expanded = openFaqId === item.id;
                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.faqItem,
                          index === FAQ_ITEMS.length - 1 && styles.faqItemLast,
                        ]}
                      >
                        <Pressable
                          onPress={() =>
                            setOpenFaqId(expanded ? null : item.id)
                          }
                          style={({ pressed }) => [
                            styles.faqQuestion,
                            pressed && styles.rowPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ expanded }}
                        >
                          <Text style={styles.faqQuestionText}>
                            {item.question}
                          </Text>
                          {expanded ? (
                            <ChevronUp
                              color={theme.colors.textMuted}
                              size={17}
                              strokeWidth={1.8}
                            />
                          ) : (
                            <ChevronDown
                              color={theme.colors.textMuted}
                              size={17}
                              strokeWidth={1.8}
                            />
                          )}
                        </Pressable>
                        {expanded ? (
                          <Text style={styles.faqAnswer}>{item.answer}</Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  safe: {
    flex: 1,
  },
  header: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(18,16,34,0.5)",
  },
  headerTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    fontSize: 22,
    letterSpacing: 0.2,
  },
  headerSpacer: {
    width: 38,
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  subtitle: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    alignSelf: "center",
    maxWidth: 310,
    marginBottom: 22,
  },
  sectionTitle: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  faqTitle: {
    marginTop: 26,
  },
  faqList: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(18,16,34,0.45)",
    overflow: "hidden",
    marginBottom: 24,
  },
  faqItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  faqItemLast: {
    borderBottomWidth: 0,
  },
  faqQuestion: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 15,
  },
  faqQuestionText: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 12,
    lineHeight: 17,
  },
  faqAnswer: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    lineHeight: 17,
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  rowPressed: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  fieldLabel: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    marginBottom: 7,
  },
  categories: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 18,
  },
  categoryChip: {
    minHeight: 36,
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 13,
  },
  categoryChipSelected: {
    borderColor: theme.colors.borderGold,
    backgroundColor: theme.colors.goldSoft,
  },
  categoryText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 10.5,
  },
  categoryTextSelected: {
    color: theme.colors.gold,
  },
  input: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: "rgba(18,16,34,0.55)",
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  messageLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  counter: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 10,
    marginBottom: 7,
  },
  messageInput: {
    minHeight: 132,
    paddingTop: 13,
    paddingBottom: 13,
  },
  error: {
    color: "#E8A0A0",
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginBottom: 10,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: "rgba(157,124,230,0.94)",
  },
  primaryButtonText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  privacy: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 10,
  },
  success: {
    flexGrow: 1,
    minHeight: 480,
    alignItems: "stretch",
    justifyContent: "center",
  },
  successIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: theme.colors.goldSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    marginBottom: 18,
  },
  successTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    fontSize: 27,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  requestId: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 1,
    textAlign: "center",
    textTransform: "uppercase",
    marginBottom: 22,
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    marginTop: 10,
  },
  secondaryButtonText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 12,
  },
});
