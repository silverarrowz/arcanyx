import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Eye, EyeOff } from "lucide-react-native";
import { theme } from "../../theme";
import { useUser } from "../../context/UserContext";
import PopupSheet from "./PopupSheet";

type Props = {
  visible: boolean;
  onClose: () => void;
};

type Mode = "login" | "register" | "forgot" | "reset";
type PendingAction = "email" | "google";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string) {
  return EMAIL_RE.test(value);
}

export default function LoginModal({ visible, onClose }: Props) {
  const {
    signInWithGoogle,
    signInWithEmail,
    registerWithEmailPassword,
    sendPasswordReset,
    resetPassword,
    authBusy,
    authError,
  } = useUser();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    setMode("login");
    setPassword("");
    setCode("");
    setInfo(null);
    setFormError(null);
    setPendingAction(null);
    setPasswordVisible(false);
  }, [visible]);

  const busy = authBusy || pendingAction !== null;
  const emailBusy = pendingAction === "email";
  const googleBusy = pendingAction === "google";
  const errorText = formError || authError;

  const closeAfterSuccess = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    onClose();
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setFormError(null);
    setInfo(null);
  };

  const updateEmail = (value: string) => {
    setEmail(value);
    setFormError(null);
  };

  const updatePassword = (value: string) => {
    setPassword(value);
    setFormError(null);
  };

  const updateName = (value: string) => {
    setName(value);
    setFormError(null);
  };

  const updateCode = (value: string) => {
    setCode(value);
    setFormError(null);
  };

  const validateEmailForm = () => {
    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();

    if (!trimmedEmail) {
      return "Введите email";
    }
    if (!isValidEmail(trimmedEmail)) {
      return "Проверьте email";
    }
    if (mode === "forgot") {
      return null;
    }
    if (!password) {
      return "Введите пароль";
    }
    if ((mode === "register" || mode === "reset") && password.length < 8) {
      return "Пароль должен быть не короче 8 символов";
    }
    if (mode === "reset" && !trimmedCode) {
      return "Введите код из письма";
    }
    return null;
  };

  const handleGoogle = () => {
    if (busy) return;
    setFormError(null);
    setPendingAction("google");
    signInWithGoogle()
      .then((ok) => {
        if (ok) closeAfterSuccess();
      })
      .catch(() => {})
      .finally(() => setPendingAction(null));
  };

  const handleEmailSubmit = () => {
    if (busy) return;
    const validationError = validateEmailForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const trimmedEmail = email.trim();
    setFormError(null);
    setPendingAction("email");

    const finish = () => setPendingAction(null);

    if (mode === "forgot") {
      sendPasswordReset(trimmedEmail)
        .then((ok) => {
          if (!ok) return;
          setInfo("Если такой аккаунт есть, мы отправили код на почту.");
          setMode("reset");
        })
        .finally(finish);
      return;
    }
    if (mode === "reset") {
      resetPassword(trimmedEmail, code.trim(), password)
        .then((ok) => {
          if (ok) closeAfterSuccess();
        })
        .finally(finish);
      return;
    }
    if (mode === "register") {
      registerWithEmailPassword(trimmedEmail, password, name.trim() || undefined)
        .then((ok) => {
          if (ok) closeAfterSuccess();
        })
        .finally(finish);
      return;
    }
    signInWithEmail(trimmedEmail, password)
      .then((ok) => {
        if (ok) closeAfterSuccess();
      })
      .finally(finish);
  };

  const title =
    mode === "register"
      ? "Регистрация"
      : mode === "forgot" || mode === "reset"
        ? "Сброс пароля"
        : "Вход";

  const submitLabel =
    mode === "register"
      ? "Создать аккаунт"
      : mode === "forgot"
        ? "Отправить код"
        : mode === "reset"
          ? "Сохранить пароль"
          : "Войти";

  return (
    <PopupSheet visible={visible} onClose={onClose}>
      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>
        Сохраните связь со своим внутренним миром. История раскладов и снов будет с вами на любом устройстве.
      </Text>

      <TextInput
        value={email}
        onChangeText={updateEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor={theme.colors.textMuted}
        style={styles.input}
        testID="login-email-input"
      />
      {mode === "register" ? (
        <TextInput
          value={name}
          onChangeText={updateName}
          placeholder="Имя (необязательно)"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
        />
      ) : null}
      {mode === "reset" ? (
        <TextInput
          value={code}
          onChangeText={updateCode}
          keyboardType="number-pad"
          placeholder="Код из письма"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
        />
      ) : null}
      {mode === "forgot" ? null : (
        <View style={styles.passwordWrap}>
          <TextInput
            value={password}
            onChangeText={updatePassword}
            secureTextEntry={!passwordVisible}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            autoComplete="password"
            placeholder={mode === "reset" ? "Новый пароль" : "Пароль"}
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.input, styles.passwordInput]}
            testID="login-password-input"
          />
          <Pressable
            onPress={() => setPasswordVisible((visibleNow) => !visibleNow)}
            style={({ pressed }) => [
              styles.passwordToggle,
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              passwordVisible ? "Скрыть пароль" : "Показать пароль"
            }
            testID="login-password-toggle"
          >
            {passwordVisible ? (
              <EyeOff color={theme.colors.textMuted} size={18} strokeWidth={1.8} />
            ) : (
              <Eye color={theme.colors.textMuted} size={18} strokeWidth={1.8} />
            )}
          </Pressable>
        </View>
      )}

      <Pressable
        onPress={handleEmailSubmit}
        disabled={busy}
        style={({ pressed }) => [
          styles.emailButton,
          (pressed || busy) && { opacity: 0.86 },
        ]}
        testID="login-email-submit"
      >
        {emailBusy ? (
          <ActivityIndicator color="#FFF7EA" />
        ) : (
          <Text style={styles.emailButtonText}>{submitLabel}</Text>
        )}
      </Pressable>

      {mode === "login" ? (
        <Pressable onPress={() => switchMode("forgot")} hitSlop={8}>
          <Text style={styles.link}>Забыли пароль?</Text>
        </Pressable>
      ) : null}

      <View style={styles.switchRow}>
        {mode === "register" ? (
          <Pressable onPress={() => switchMode("login")}>
            <Text style={styles.link}>Уже есть аккаунт? Войти</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => switchMode("register")}>
            <Text style={styles.link}>Зарегистрироваться</Text>
          </Pressable>
        )}
      </View>

      {info ? <Text style={styles.info}>{info}</Text> : null}
      {errorText ? <Text style={styles.authError}>{errorText}</Text> : null}

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>или</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable
        onPress={handleGoogle}
        disabled={busy}
        style={({ pressed }) => [
          styles.googleButton,
          (pressed || busy) && { opacity: 0.86 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Войти через Google"
        testID="login-google-btn"
      >
        {googleBusy ? (
          <ActivityIndicator color="#191919" />
        ) : (
          <>
            <Text style={styles.googleMark}>G</Text>
            <Text style={styles.googleButtonText}>Продолжить с Google</Text>
          </>
        )}
      </Pressable>
      </ScrollView>
    </PopupSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    fontSize: 29,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  formScroll: {
    alignSelf: "stretch",
    flexGrow: 1,
    flexShrink: 1,
  },
  formContent: {
    alignItems: "center",
    paddingBottom: 8,
  },
  subtitle: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 310,
    marginTop: 7,
    marginBottom: 18,
  },
  input: {
    alignSelf: "stretch",
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: "rgba(18,16,34,0.55)",
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  passwordWrap: {
    alignSelf: "stretch",
    marginBottom: 10,
  },
  passwordInput: {
    marginBottom: 0,
    paddingRight: 48,
  },
  passwordToggle: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emailButton: {
    alignSelf: "stretch",
    minHeight: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(157,124,230,0.9)",
    marginTop: 4,
  },
  emailButtonText: {
    color: "#FFF7EA",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
  },
  link: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    marginTop: 12,
    textAlign: "center",
  },
  switchRow: {
    marginTop: 4,
  },
  info: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
  },
  divider: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  dividerText: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  googleButton: {
    alignSelf: "stretch",
    minHeight: 52,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
  },
  googleMark: {
    color: "#191919",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 20,
  },
  googleButtonText: {
    color: "#191919",
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
  },
  authError: {
    color: "#E8A0A0",
    fontFamily: theme.fonts.body,
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
  },
});
