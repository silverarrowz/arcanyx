import React from "react";
import { StyleSheet, View, ViewStyle, StyleProp } from "react-native";
import { theme } from "../theme";

type Props = {
  style?: StyleProp<ViewStyle>;
};

export default function CosmicBackground({ style }: Props) {
  return (
    <View pointerEvents="none" style={[styles.container, style]} />
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.bg,
    overflow: "hidden",
  },
});
