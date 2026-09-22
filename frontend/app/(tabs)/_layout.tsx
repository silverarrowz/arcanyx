import React from "react";
import { Tabs } from "expo-router";
import { StyleSheet, View, Text, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { CommonActions, PlatformPressable } from "expo-router/react-navigation";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Headphones, Wand2 } from "lucide-react-native";
import {
  DreamTabIcon,
  HomeTabIcon,
  ProfileTabIcon,
} from "../../src/components/icons/TabIcons";
import { theme } from "../../src/theme";

type IconProps = { color: string; focused: boolean };
type TabIconComponent = React.ComponentType<Record<string, unknown>>;

function TabBarIcon({
  Icon,
  color,
  focused,
  label,
}: IconProps & { Icon: TabIconComponent; label: string }) {
  return (
    <View style={styles.iconWrap}>
      <View style={[styles.activePill, focused && styles.activePillFocused]}>
        {focused && (
          <LinearGradient
            colors={["rgba(201,168,255,0.16)", "rgba(44,35,64,0.28)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={styles.iconCircle}>
          <Icon
            color={color}
            width={focused ? 22 : 20}
            height={focused ? 22 : 20}
            size={focused ? 22 : 20}
            strokeWidth={focused ? 2 : 1.6}
          />
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

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View pointerEvents="box-none" style={styles.tabBarDock}>
      <View style={styles.tabBar}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill}>
          <View style={styles.tabBarOverlay} />
        </BlurView>
        <View style={styles.tabBarRow}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const { options } = descriptors[route.key];
            const color = focused
              ? theme.colors.archive.accent
              : theme.colors.textDim;
            const icon = options.tabBarIcon?.({ focused, color, size: 22 });
            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.dispatch({
                  ...CommonActions.navigate(route.name, route.params),
                  target: state.key,
                });
              }
            };
            return (
              <PlatformPressable
                key={route.key}
                onPress={onPress}
                style={[styles.tabBarItem, { justifyContent: "center" }]}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                testID={options.tabBarButtonTestID}
              >
                {icon}
              </PlatformPressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      // `tabBar` is a navigator prop, not a screen option — screenOptions is ignored here.
      tabBar={(props) => <FloatingTabBar {...props} />}
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
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
              Icon={HomeTabIcon}
              color={color}
              focused={focused}
              label="Сегодня"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="gadania"
        options={{
          title: "Гадания",
          tabBarButtonTestID: "tab-gadania",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              Icon={Wand2}
              color={color}
              focused={focused}
              label="Гадания"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="meditations"
        options={{
          title: "Медитации",
          tabBarButtonTestID: "tab-meditations",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              Icon={Headphones}
              color={color}
              focused={focused}
              label="Медитации"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="dreambook"
        options={{
          title: "Сонник",
          tabBarButtonTestID: "tab-dreambook",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              Icon={DreamTabIcon}
              color={color}
              focused={focused}
              label="Сонник"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: "Профиль",
          tabBarButtonTestID: "tab-profile",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              Icon={ProfileTabIcon}
              color={color}
              focused={focused}
              label="Профиль"
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarDock: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: Platform.OS === "ios" ? 24 : 16,
  },
  tabBar: {
    height: 70,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: theme.colors.archive.rule,
    backgroundColor: "transparent",
    overflow: "hidden",
    elevation: 12,
    shadowColor: "#05030D",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
  },
  tabBarRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  tabBarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12,11,17,0.92)",
  },
  tabBarItem: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 0,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  activePill: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    borderRadius: 22,
    paddingHorizontal: 6,
    paddingVertical: 5,
    overflow: "hidden",
  },
  activePillFocused: {
    backgroundColor: "rgba(201,168,255,0.08)",
    borderWidth: 1,
    borderColor: theme.colors.archive.rule,
    shadowColor: theme.colors.archive.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
  },
  iconCircle: {
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  iconLabel: {
    fontSize: 8,
    fontFamily: theme.fonts.bodyMedium,
    marginTop: 2,
    letterSpacing: 0.2,
  },
});
