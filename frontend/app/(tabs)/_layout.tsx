import React from "react";
import { Tabs } from "expo-router";
import { StyleSheet, View, Text, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { PlatformPressable } from "@react-navigation/elements";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Sparkles, Eye, Layers, BookOpen } from "lucide-react-native";
import { theme } from "../../src/theme";

type IconProps = { color: string; focused: boolean };

function TabBarIcon({
  Icon,
  color,
  focused,
  label,
}: IconProps & { Icon: any; label: string }) {
  return (
    <View style={styles.iconWrap}>
      <View style={[styles.activePill, focused && styles.activePillFocused]}>
        {focused && (
          <LinearGradient
            colors={["rgba(239,160,192,0.44)", "rgba(157,124,230,0.34)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={styles.iconCircle}>
          <Icon color={color} size={focused ? 22 : 20} strokeWidth={focused ? 2 : 1.6} />
          <Text
            style={[
              styles.iconLabel,
              { color: focused ? theme.colors.text : theme.colors.textDim },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      </View>
    </View>
  );
}

function CenteredTabBarButton(props: BottomTabBarButtonProps) {
  // Default UITabKit style uses justifyContent 'flex-start' for a column tab; center for our pill bar.
  return (
    <PlatformPressable {...props} style={[props.style, { justifyContent: "center" }]} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      // Floating tab bar handles bottom inset via `tabBar.bottom`; disable extra internal bottom padding.
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarButton: (p) => <CenteredTabBarButton {...p} />,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarBackground: () => (
          <BlurView
            intensity={40}
            tint="dark"
            style={StyleSheet.absoluteFill}
          >
            <View style={styles.tabBarOverlay} />
          </BlurView>
        ),
        tabBarActiveTintColor: theme.colors.gold,
        tabBarInactiveTintColor: theme.colors.textDim,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Сегодня",
          tabBarButtonTestID: "tab-home",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              Icon={Sparkles}
              color={color}
              focused={focused}
              label="Сегодня"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="oracle"
        options={{
          title: "Оракул",
          tabBarButtonTestID: "tab-oracle",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              Icon={Eye}
              color={color}
              focused={focused}
              label="Оракул"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="tarot"
        options={{
          title: "Таро",
          tabBarButtonTestID: "tab-tarot",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              Icon={Layers}
              color={color}
              focused={focused}
              label="Таро"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: "Дневник",
          tabBarButtonTestID: "tab-diary",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              Icon={BookOpen}
              color={color}
              focused={focused}
              label="Дневник"
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 24 : 16,
    left: 16,
    right: 16,
    height: 70,
    borderRadius: 30,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: "transparent",
    overflow: "hidden",
    elevation: 12,
    shadowColor: "#05030D",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
  },
  tabBarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26,23,43,0.86)",
  },
  tabBarItem: {
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 0,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
  },
  activePill: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 40,
    borderRadius: 40,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: "hidden",
  },
  activePillFocused: {
    backgroundColor: theme.colors.purpleSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    shadowColor: theme.colors.mauve,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "transparent",
  },
  iconLabel: {
    fontSize: 10,
    fontFamily: theme.fonts.bodyMedium,
    marginTop: 3,
    letterSpacing: 0.5,
  },
});
