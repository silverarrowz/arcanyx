import React from "react";
import { Tabs } from "expo-router";
import { StyleSheet, View, Text, Platform } from "react-native";
import { BlurView } from "expo-blur";
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
      <View
        style={[
          styles.iconCircle,
          focused && styles.iconCircleActive,
        ]}
      >
        <Icon color={color} size={focused ? 22 : 20} strokeWidth={focused ? 2 : 1.6} />
      </View>
      <Text
        style={[
          styles.iconLabel,
          { color: focused ? theme.colors.gold : theme.colors.textDim },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
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
    height: 76,
    borderRadius: 28,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "transparent",
    overflow: "hidden",
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
  },
  tabBarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(13,14,21,0.7)",
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 64,
    paddingTop: 8,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "transparent",
  },
  iconCircleActive: {
    backgroundColor: "rgba(212,175,55,0.12)",
    borderColor: "rgba(212,175,55,0.45)",
    shadowColor: theme.colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  iconLabel: {
    fontSize: 10,
    fontFamily: theme.fonts.bodyMedium,
    marginTop: 4,
    letterSpacing: 0.5,
  },
});
