import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Mask,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

const RIM_STROKE = 1.75;
const RIM_INSET = 2;
const RIM_SIDE_FADE = 22;

type Props = {
  width: number;
  radius: number;
  idPrefix: string;
};

export default function GoldSheetRim({ width, radius, idPrefix }: Props) {
  if (width <= 0) return null;

  const r = Math.max(10, radius - RIM_INSET);
  const x0 = RIM_INSET;
  const x1 = width - RIM_INSET;
  const y0 = RIM_INSET;
  const yEnd = y0 + r + RIM_SIDE_FADE;
  const height = yEnd + RIM_STROKE;
  const strokeId = `${idPrefix}Stroke`;
  const fadeId = `${idPrefix}Fade`;
  const maskId = `${idPrefix}Mask`;
  const d = [
    `M ${x0} ${yEnd}`,
    `L ${x0} ${y0 + r}`,
    `A ${r} ${r} 0 0 1 ${x0 + r} ${y0}`,
    `L ${x1 - r} ${y0}`,
    `A ${r} ${r} 0 0 1 ${x1} ${y0 + r}`,
    `L ${x1} ${yEnd}`,
  ].join(" ");

  return (
    <View style={styles.rim} pointerEvents="none">
      <Svg width={width} height={height}>
      <Defs>
        <SvgLinearGradient id={strokeId} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#FFD79A" stopOpacity={0.88} />
          <Stop offset="50%" stopColor="#F3C9A4" stopOpacity={0.96} />
          <Stop offset="100%" stopColor="#FFD79A" stopOpacity={0.88} />
        </SvgLinearGradient>
        <SvgLinearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#fff" stopOpacity={1} />
          <Stop offset="42%" stopColor="#fff" stopOpacity={1} />
          <Stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </SvgLinearGradient>
        <Mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
          <Rect width={width} height={height} fill={`url(#${fadeId})`} />
        </Mask>
      </Defs>
      <Path
        d={d}
        stroke={`url(#${strokeId})`}
        strokeWidth={RIM_STROKE}
        fill="none"
        strokeLinecap="butt"
        strokeLinejoin="round"
        mask={`url(#${maskId})`}
      />
    </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  rim: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 3,
  },
});
