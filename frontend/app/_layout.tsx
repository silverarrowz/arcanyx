import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as WebBrowser from "expo-web-browser";
import {
  CormorantGaramond_600SemiBold,
  CormorantGaramond_600SemiBold_Italic,
  CormorantGaramond_700Bold,
  CormorantGaramond_700Bold_Italic,
} from "@expo-google-fonts/cormorant-garamond";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  useFonts,
} from "@expo-google-fonts/manrope";
import { YesevaOne_400Regular } from "@expo-google-fonts/yeseva-one";
import { View } from "react-native";
import { DailyCardProvider } from "../src/context/DailyCardContext";
import { HistoryProvider } from "../src/context/HistoryContext";
import { MeditationFavoritesProvider } from "../src/context/MeditationFavoritesContext";
import { TarotSpreadsProvider } from "../src/context/TarotSpreadsContext";
import { UserProvider, useUser } from "../src/context/UserContext";
import * as Notifications from "expo-notifications";
import { setDailyQuoteNotificationsEnabled } from "../src/services/dailyQuoteNotifications";
import { theme } from "../src/theme";
import { prefetchAppImages } from "../src/utils/prefetchImages";
import AppIntro, { INTRO_BG } from "../src/components/AppIntro";

WebBrowser.maybeCompleteAuthSession();
SplashScreen.preventAutoHideAsync().catch(() => {});
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function AppStack() {
  const { hydrated, notificationsEnabled } = useUser();

  useEffect(() => {
    if (!hydrated) return;
    setDailyQuoteNotificationsEnabled(notificationsEnabled).catch(() => {});
  }, [hydrated, notificationsEnabled]);

  return (
    <TarotSpreadsProvider>
      <HistoryProvider>
        <MeditationFavoritesProvider>
          <DailyCardProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.colors.bg },
                animation: "fade",
              }}
            />
          </DailyCardProvider>
        </MeditationFavoritesProvider>
      </HistoryProvider>
    </TarotSpreadsProvider>
  );
}

/** Hard ceiling in case the intro never reports back. */
const INTRO_FAILSAFE_MS = 8000;

export default function RootLayout() {
  const [introDone, setIntroDone] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const [loaded] = useFonts({
    CormorantGaramond_600SemiBold,
    CormorantGaramond_600SemiBold_Italic,
    CormorantGaramond_700Bold,
    CormorantGaramond_700Bold_Italic,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    YesevaOne_400Regular,
  });

  useEffect(() => {
    prefetchAppImages();
  }, []);

  // AppIntro hides the splash once its overlay is on screen; this only covers
  // the case where the intro never mounts.
  useEffect(() => {
    if (introDone) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [introDone]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setContentVisible(true);
      setIntroDone(true);
    }, INTRO_FAILSAFE_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: INTRO_BG }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: INTRO_BG }}>
      {/* expo-router hides the native splash as soon as the navigator mounts,
          so the app is kept invisible (but mounting) until the intro hands off
          — otherwise the tabs paint for a frame before the overlay presents. */}
      <View
        collapsable={false}
        pointerEvents={contentVisible ? "auto" : "none"}
        style={{ flex: 1, opacity: contentVisible ? 1 : 0 }}
      >
        <UserProvider>
          <AppStack />
        </UserProvider>
      </View>
      {introDone ? null : (
        <AppIntro
          onDone={() => setIntroDone(true)}
          onRevealContent={() => setContentVisible(true)}
        />
      )}
    </GestureHandlerRootView>
  );
}
