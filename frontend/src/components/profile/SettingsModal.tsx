import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  Bell,
  ChevronRight,
  Crown,
  LifeBuoy,
  LogIn,
  LogOut,
  UserRound,
  X,
} from "lucide-react-native";
import { usePathname, useRouter } from "expo-router";
import { useUser } from "../../context/UserContext";
import { theme } from "../../theme";
import GoldSheetRim from "./GoldSheetRim";
import LoginModal from "./LoginModal";
import ProModal from "./ProModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SHEET_RADIUS = 28;

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function SettingsModal({ visible, onClose }: Props) {
  const {
    isAuthenticated,
    isPro,
    email,
    notificationsEnabled,
    setNotificationsEnabled,
    signInWithGoogle,
    signOut,
    authBusy,
    authError,
  } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [proVisible, setProVisible] = useState(false);
  const [loginVisible, setLoginVisible] = useState(false);
  const [sheetWidth, setSheetWidth] = useState(0);
  const sheetY = useSharedValue(56);

  useEffect(() => {
    if (!visible) {
      sheetY.value = 56;
      return;
    }
    sheetY.value = 56;
    sheetY.value = withTiming(0, {
      duration: 340,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, sheetY]);

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));

  const onSheetLayout = (event: LayoutChangeEvent) => {
    setSheetWidth(event.nativeEvent.layout.width);
  };

  const closeSettings = () => {
    onClose();
  };

  const openPro = () => {
    closeSettings();
    setProVisible(true);
  };

  const openLogin = () => {
    closeSettings();
    setLoginVisible(true);
  };

  const openSupport = () => {
    closeSettings();
    router.push("/support" as never);
  };

  const openProfile = () => {
    Haptics.selectionAsync().catch(() => {});
    closeSettings();
    if (pathname?.includes("diary")) return;
    router.navigate("/(tabs)/diary" as never);
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={closeSettings}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSettings} />
          <Animated.View
            style={[
              styles.sheetWrap,
              sheetAnimStyle,
              { paddingBottom: Math.max(insets.bottom, 20) + 16 },
            ]}
            onLayout={onSheetLayout}
          >
            <GoldSheetRim
              width={sheetWidth}
              radius={SHEET_RADIUS}
              idPrefix="settingsRim"
            />
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>Настройки</Text>
              <Pressable onPress={closeSettings} style={styles.closeButton} hitSlop={10}>
                <X color={theme.colors.textMuted} size={22} />
              </Pressable>
            </View>

            {!isAuthenticated ? (
              <View style={styles.authBlock}>
                <Pressable
                  onPress={() => {
                    if (authBusy) return;
                    signInWithGoogle()
                      .then((ok) => {
                        if (!ok) return;
                        Haptics.notificationAsync(
                          Haptics.NotificationFeedbackType.Success,
                        ).catch(() => {});
                        closeSettings();
                      })
                      .catch(() => {});
                  }}
                  disabled={authBusy}
                  style={({ pressed }) => [
                    styles.googleButton,
                    (pressed || authBusy) && { opacity: 0.86 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Войти через Google"
                >
                  {authBusy ? (
                    <ActivityIndicator color="#191919" />
                  ) : (
                    <>
                      <Text style={styles.googleMark}>G</Text>
                      <Text style={styles.googleButtonText}>Продолжить с Google</Text>
                    </>
                  )}
                </Pressable>
                {authError ? <Text style={styles.authError}>{authError}</Text> : null}
                <Pressable
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={openLogin}
                  accessibilityRole="button"
                  accessibilityLabel="Войти"
                  testID="settings-login-btn"
                >
                  <View style={styles.rowIcon}>
                    <LogIn color={theme.colors.textDim} size={18} strokeWidth={1.7} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>Войти</Text>
                  </View>
                  <ChevronRight color={theme.colors.textMuted} size={18} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={openProfile}
                accessibilityRole="button"
                accessibilityLabel={email ? `Профиль, ${email}` : "Профиль"}
              >
                <View style={styles.rowIcon}>
                  <UserRound color={theme.colors.textDim} size={18} strokeWidth={1.7} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>Профиль</Text>
                  {email ? (
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      {email}
                    </Text>
                  ) : null}
                </View>
                <ChevronRight color={theme.colors.textMuted} size={18} />
              </Pressable>
            )}

            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Bell color={theme.colors.textDim} size={18} strokeWidth={1.7} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Уведомления</Text>
                <Text style={styles.rowSubtitle}>Ежедневные подсказки и напоминания</Text>
              </View>
              <Pressable
                onPress={() => setNotificationsEnabled(!notificationsEnabled)}
                accessibilityRole="switch"
                accessibilityState={{ checked: notificationsEnabled }}
                style={[
                  styles.switch,
                  notificationsEnabled && styles.switchActive,
                ]}
              >
                <View
                  style={[
                    styles.switchThumb,
                    notificationsEnabled && styles.switchThumbActive,
                  ]}
                />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={openPro}
            >
              <View style={styles.rowIcon}>
                <Crown color={theme.colors.textDim} size={18} strokeWidth={1.7} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Arcanyx Pro</Text>
                <Text style={styles.rowSubtitle}>
                  {isPro ? "Подписка активна" : "Возможности подписки"}
                </Text>
              </View>
              <ChevronRight color={theme.colors.textMuted} size={18} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={openSupport}
              accessibilityRole="button"
              accessibilityLabel="Поддержка"
              testID="settings-support-btn"
            >
              <View style={styles.rowIcon}>
                <LifeBuoy color={theme.colors.textDim} size={18} strokeWidth={1.7} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Поддержка</Text>
                <Text style={styles.rowSubtitle}>Частые вопросы и связь с нами</Text>
              </View>
              <ChevronRight color={theme.colors.textMuted} size={18} />
            </Pressable>

            {isAuthenticated ? (
              <Pressable
                style={({ pressed }) => [
                  styles.logoutButton,
                  pressed && { opacity: 0.78 },
                ]}
                onPress={() => {
                  signOut();
                  closeSettings();
                }}
              >
                <Text style={styles.logoutText}>Выйти</Text>
                <LogOut color={theme.colors.textDim} size={17} strokeWidth={1.7} />
              </Pressable>
            ) : null}
          </Animated.View>
        </View>
      </Modal>

      <ProModal visible={proVisible} onClose={() => setProVisible(false)} />
      <LoginModal visible={loginVisible} onClose={() => setLoginVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(10,8,20,0.75)",
  },
  sheetWrap: {
    width: "100%",
    backgroundColor: "#18152B",
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    overflow: "hidden",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 17,
    zIndex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    fontSize: 29,
    letterSpacing: 0.2,
  },
  closeButton: {
    padding: 4,
  },
  authBlock: {
    marginBottom: 6,
  },
  googleButton: {
    minHeight: 52,
    marginBottom: 8,
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
    marginTop: 8,
    marginBottom: 6,
  },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  rowPressed: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    marginRight: 11,
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
  },
  rowSubtitle: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 10.5,
    marginTop: 2,
  },
  switch: {
    width: 46,
    height: 27,
    borderRadius: 14,
    padding: 3,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  switchActive: {
    backgroundColor: "rgba(255,215,154,0.28)",
    borderColor: theme.colors.borderGold,
  },
  switchThumb: {
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: "rgba(181,174,201,0.85)",
  },
  switchThumbActive: {
    alignSelf: "flex-end",
    backgroundColor: theme.colors.gold,
  },
  logoutButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginTop: 20,
  },
  logoutText: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
  },
});
