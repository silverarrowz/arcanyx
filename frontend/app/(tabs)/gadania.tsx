import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { theme } from "../../src/theme";
import CosmicBackground from "../../src/components/CosmicBackground";
import OracleScreen from "../../src/screens/OracleScreen";
import TarotScreen from "../../src/screens/TarotScreen";
import { useTarotSpreads } from "../../src/context/TarotSpreadsContext";

const ICON_CARD = require("../../assets/icons/icon-card2.png");
const ICON_ORACLE = require("../../assets/icons/icon-oracle.png");

type GadanieTab = "oracle" | "tarot";

export default function GadaniaScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { refresh: refreshSpreads } = useTarotSpreads();
  const [active, setActive] = useState<GadanieTab>(() =>
    tab === "oracle" ? "oracle" : "tarot",
  );
  const [mounted, setMounted] = useState({
    oracle: tab === "oracle",
    tarot: tab !== "oracle",
  });

  useFocusEffect(
    useCallback(() => {
      void refreshSpreads();
    }, [refreshSpreads]),
  );

  useEffect(() => {
    if (tab === "tarot") setActive("tarot");
    else if (tab === "oracle") setActive("oracle");
  }, [tab]);

  useEffect(() => {
    setMounted((prev) => (prev[active] ? prev : { ...prev, [active]: true }));
  }, [active]);

  const select = (t: GadanieTab) => {
    if (t === active) return;
    Haptics.selectionAsync().catch(() => {});
    setActive(t);
    router.setParams({ tab: t });
  };

  return (
    <View style={styles.root} testID="gadania-root">
      {active === "tarot" ? <CosmicBackground variant="tarot" /> : null}
      <SafeAreaView edges={["top"]} style={styles.segmentSafe}>
        <View style={styles.segmentPill}>
          <Pressable
            onPress={() => select("oracle")}
            style={({ pressed }) => [
              styles.segOption,
              active === "oracle" && styles.segOptionActive,
              pressed && { opacity: 0.92 },
            ]}
            testID="gadania-tab-oracle"
          >
            {active === "oracle" ? (
              <LinearGradient
                colors={["rgba(239,160,192,0.45)", "rgba(157,124,230,0.28)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <Image
              source={ICON_ORACLE}
              style={{
                width: 26,
                height: 26,
                marginRight: 4,
              }}
              tintColor={active === "oracle" ? theme.colors.text : theme.colors.textDim}
              contentFit="contain"
            />
            <Text
              style={[
                styles.segText,
                active === "oracle" && styles.segTextActive,
              ]}
            >
              Оракул
            </Text>
          </Pressable>
          <Pressable
            onPress={() => select("tarot")}
            style={({ pressed }) => [
              styles.segOption,
              active === "tarot" && styles.segOptionActive,
              pressed && { opacity: 0.92 },
            ]}
            testID="gadania-tab-tarot"
          >
            {active === "tarot" ? (
              <LinearGradient
                colors={["rgba(239,160,192,0.45)", "rgba(157,124,230,0.28)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <Image
              source={ICON_CARD}
              style={{
                width: 32,
                height: 32,
                marginRight: 4,
              }}
              tintColor={active === "tarot" ? theme.colors.text : theme.colors.textDim}
              contentFit="contain"
            />
            <Text
              style={[styles.segText, active === "tarot" && styles.segTextActive]}
            >
              Таро
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
      <View style={styles.content}>
        {mounted.oracle ? (
          <View
            style={[styles.pane, active !== "oracle" && styles.paneHidden]}
            pointerEvents={active === "oracle" ? "auto" : "none"}
          >
            <OracleScreen embedded />
          </View>
        ) : null}
        {mounted.tarot ? (
          <View
            style={[styles.pane, active !== "tarot" && styles.paneHidden]}
            pointerEvents={active === "tarot" ? "auto" : "none"}
          >
            <TarotScreen embedded />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    flex: 1,
  },
  pane: {
    flex: 1,
  },
  paneHidden: {
    display: "none",
  },
  segmentSafe: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 6,
    alignItems: "center",
  },
  segmentPill: {
    flexDirection: "row",
    alignSelf: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: "rgba(26,23,43,0.88)",
    padding: 4,
    gap: 4,
  },
  segOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 999,
    overflow: "hidden",
    minWidth: 118,
  },
  segOptionActive: {
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
  },
  segText: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 0.35,
    color: theme.colors.textDim,
  },
  segTextActive: {
    color: theme.colors.text,
  },
});
