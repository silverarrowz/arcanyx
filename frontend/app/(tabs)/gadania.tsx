import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Eye, Layers } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../../src/theme";
import OracleScreen from "../../src/screens/OracleScreen";
import TarotScreen from "../../src/screens/TarotScreen";
import { useRemountOnTabFocus } from "../../src/hooks/useRemountOnTabFocus";

type GadanieTab = "oracle" | "tarot";

export default function GadaniaScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [active, setActive] = useState<GadanieTab>(() =>
    tab === "tarot" ? "tarot" : "oracle",
  );
  const remountKey = useRemountOnTabFocus();

  useEffect(() => {
    if (tab === "tarot") setActive("tarot");
    else if (tab === "oracle") setActive("oracle");
  }, [tab]);

  const select = (t: GadanieTab) => {
    if (t === active) return;
    Haptics.selectionAsync().catch(() => {});
    setActive(t);
    router.setParams({ tab: t });
  };

  return (
    <View style={styles.root} testID="gadania-root">
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
            <Eye
              color={active === "oracle" ? theme.colors.text : theme.colors.textDim}
              size={17}
              strokeWidth={active === "oracle" ? 2 : 1.6}
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
            <Layers
              color={active === "tarot" ? theme.colors.text : theme.colors.textDim}
              size={17}
              strokeWidth={active === "tarot" ? 2 : 1.6}
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
        {active === "oracle" ? (
          <OracleScreen key={`oracle-${remountKey}`} embedded />
        ) : (
          <TarotScreen key={`tarot-${remountKey}`} embedded />
        )}
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
  segmentSafe: {
    paddingHorizontal: 20,
    paddingBottom: 8,
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
