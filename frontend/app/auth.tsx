import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useUser } from "../src/context/UserContext";
import { theme } from "../src/theme";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { code, error } = useLocalSearchParams<{ code?: string | string[]; error?: string | string[] }>();
  const { completeAuthFromCode, isAuthenticated, authBusy, authError } = useUser();
  const started = useRef(false);

  const codeValue = Array.isArray(code) ? code[0] : code;
  const errorValue = Array.isArray(error) ? error[0] : error;

  useEffect(() => {
    if (typeof window !== "undefined" && window.opener) {
      return;
    }
    if (isAuthenticated) {
      router.replace("/");
      return;
    }
    if (!codeValue || started.current) return;
    started.current = true;
    completeAuthFromCode(codeValue).then((ok) => {
      if (ok) router.replace("/");
    });
  }, [codeValue, completeAuthFromCode, isAuthenticated, router]);

  const message =
    errorValue && errorValue !== "cancelled"
      ? "Не удалось войти через Google"
      : authError;

  return (
    <View style={styles.screen}>
      {message ? (
        <>
          <Text style={styles.title}>Вход не выполнен</Text>
          <Text style={styles.subtitle}>{message}</Text>
          <Pressable onPress={() => router.replace("/")} style={styles.button}>
            <Text style={styles.buttonText}>На главную</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color={theme.colors.gold} />
          <Text style={styles.title}>Входим в Arcanyx</Text>
          <Text style={styles.subtitle}>
            {authBusy ? "Подтверждаем аккаунт Google…" : "Почти готово"}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 10,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.headingBold,
    fontSize: 28,
    textAlign: "center",
    marginTop: 12,
  },
  subtitle: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    marginTop: 18,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  buttonText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 14,
  },
});
