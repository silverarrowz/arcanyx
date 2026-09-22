import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import * as Haptics from "expo-haptics";
import Svg, {
  Defs,
  Ellipse,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const LOGO = require("../../assets/home/logo.png");
const LOGO_ASPECT = 901 / 286;

/** Near-black with just enough violet in it to not read as grey. */
export const INTRO_BG = "#0B0910";

/** Sparkle sits in the counter of the A in logo.png. */
const SPARKLE_X = 0.112;
const SPARKLE_Y = 0.503;
/** Wordmark centre, as a fraction of screen height. */
const LOGO_CENTER_Y = 0.47;

/** Beat sheet, in ms from mount. */
const LOGO_IN_AT = 700;
const LOGO_IN_MS = 1700;
const GLOW_AT = 1950;
const EXIT_AT = 3900;
const EXIT_MS = 700;
/**
 * The app behind us is revealed slightly before the fade starts, while this
 * overlay is still fully opaque — so the handoff is never visible.
 */
const REVEAL_LEAD_MS = 200;
/** Safety net: never leave the native splash up if layout never reports. */
const SPLASH_FALLBACK_MS = 1500;

/**
 * One hue only. Two off-centre washes at these opacities land the brightest
 * part of the backdrop around #1B162A — visible as depth, never as colour.
 */
const AMBIENT_COLOR = "#2C2340";

const AMBIENT: {
  x: number;
  y: number;
  size: number;
  ratio: number;
  opacity: number;
  drift: { x: number; y: number; rotate: number };
  duration: number;
  delay: number;
}[] = [
  {
    x: 0.33,
    y: 0.43,
    size: 1.6,
    ratio: 1.12,
    opacity: 0.5,
    drift: { x: 0.035, y: -0.025, rotate: 4 },
    duration: 11000,
    delay: 0,
  },
  {
    x: 0.84,
    y: 0.76,
    size: 1.15,
    ratio: 0.85,
    opacity: 0.24,
    drift: { x: -0.03, y: 0.028, rotate: -5 },
    duration: 13000,
    delay: 900,
  },
];

function shouldHoldIntro() {
  if (!__DEV__ || Platform.OS !== "web") return false;
  try {
    return new URLSearchParams(window.location.search).get("holdIntro") === "1";
  } catch {
    return false;
  }
}

type Props = {
  /** Unmount the overlay. */
  onDone: () => void;
  /** Make the app visible underneath, just before this overlay fades. */
  onRevealContent: () => void;
};

export default function AppIntro({ onDone, onRevealContent }: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [canvas, setCanvas] = useState({ width: 0, height: 0 });
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const width = canvas.width || windowWidth;
  const height = canvas.height || windowHeight;

  const overlay = useSharedValue(1);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.965);
  const logoLift = useSharedValue(8);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.6);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onRevealRef = useRef(onRevealContent);
  onRevealRef.current = onRevealContent;
  const finishingRef = useRef(false);
  const revealedRef = useRef(false);
  const splashHiddenRef = useRef(false);
  const holdIntro = shouldHoldIntro();

  const finish = useCallback(() => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    onDoneRef.current();
  }, []);

  const revealContent = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    onRevealRef.current();
  }, []);

  /**
   * The native splash stays up until this overlay has actually laid out —
   * otherwise the tab screens paint for a frame before the modal presents.
   */
  const revealIntro = useCallback(() => {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(revealIntro, SPLASH_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [revealIntro]);

  useEffect(() => {
    let hapticTimer: ReturnType<typeof setTimeout> | null = null;
    let revealTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const play = (slow: boolean) => {
      if (cancelled) return;
      setReduceMotion(slow);

      if (slow) {
        logoOpacity.value = 1;
        logoScale.value = 1;
        logoLift.value = 0;
        glowOpacity.value = 0.5;
        glowScale.value = 1;
        if (!holdIntro) {
          revealTimer = setTimeout(revealContent, 1600 - REVEAL_LEAD_MS);
          overlay.value = withDelay(
            1600,
            withTiming(0, { duration: 420 }, (done) => {
              if (done) runOnJS(finish)();
            }),
          );
        }
        return;
      }

      // Wordmark surfaces late and slowly, like it's developing out of the dark.
      logoOpacity.value = withDelay(
        LOGO_IN_AT,
        withTiming(1, { duration: LOGO_IN_MS, easing: Easing.inOut(Easing.quad) }),
      );
      logoScale.value = withDelay(
        LOGO_IN_AT,
        withTiming(1, {
          duration: LOGO_IN_MS + 500,
          easing: Easing.out(Easing.cubic),
        }),
      );
      logoLift.value = withDelay(
        LOGO_IN_AT,
        withTiming(0, {
          duration: LOGO_IN_MS + 500,
          easing: Easing.out(Easing.cubic),
        }),
      );

      // Soft bloom in the A — no hard edges, then a slow breath.
      glowOpacity.value = withDelay(
        GLOW_AT,
        withSequence(
          withTiming(0.9, { duration: 900, easing: Easing.out(Easing.quad) }),
          withRepeat(
            withSequence(
              withTiming(0.55, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
              withTiming(0.85, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            false,
          ),
        ),
      );
      glowScale.value = withDelay(
        GLOW_AT,
        withSequence(
          withTiming(1.06, { duration: 950, easing: Easing.out(Easing.cubic) }),
          withRepeat(
            withSequence(
              withTiming(0.94, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
              withTiming(1.06, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            false,
          ),
        ),
      );

      if (!holdIntro) {
        revealTimer = setTimeout(revealContent, EXIT_AT - REVEAL_LEAD_MS);
        overlay.value = withDelay(
          EXIT_AT,
          withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) }, (done) => {
            if (done) runOnJS(finish)();
          }),
        );
      }

      hapticTimer = setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }, GLOW_AT);
    };

    const motion = holdIntro
      ? Promise.resolve(false)
      : AccessibilityInfo.isReduceMotionEnabled();
    motion.then(play).catch(() => play(false));

    return () => {
      cancelled = true;
      if (hapticTimer) clearTimeout(hapticTimer);
      if (revealTimer) clearTimeout(revealTimer);
      cancelAnimation(overlay);
      cancelAnimation(logoOpacity);
      cancelAnimation(logoScale);
      cancelAnimation(logoLift);
      cancelAnimation(glowOpacity);
      cancelAnimation(glowScale);
    };
  }, [
    finish,
    glowOpacity,
    glowScale,
    holdIntro,
    logoLift,
    logoOpacity,
    logoScale,
    overlay,
    revealContent,
  ]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoLift.value }, { scale: logoScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const logoWidth = Math.min(width * 0.78, 420);
  const logoHeight = logoWidth / LOGO_ASPECT;
  const glowSize = logoHeight * 1.5;
  const sparkleCx = logoWidth * SPARKLE_X;
  const sparkleCy = logoHeight * SPARKLE_Y;

  const skip = useCallback(() => {
    if (holdIntro || finishingRef.current) return;
    revealContent();
    overlay.value = withTiming(
      0,
      { duration: 300, easing: Easing.in(Easing.cubic) },
      (done) => {
        if (done) runOnJS(finish)();
      },
    );
  }, [finish, holdIntro, overlay, revealContent]);

  const animateBackdrop = reduceMotion === false;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={skip}
    >
      <View
        collapsable={false}
        pointerEvents="auto"
        accessibilityViewIsModal
        accessible
        accessibilityLabel="Arcanyx"
        style={styles.root}
      >
        <Animated.View style={[styles.fade, overlayStyle]}>
          <View
            style={styles.canvas}
            pointerEvents="box-none"
            onLayout={({ nativeEvent }) => {
              const next = nativeEvent.layout;
              setCanvas((current) =>
                current.width === Math.round(next.width) &&
                current.height === Math.round(next.height)
                  ? current
                  : {
                      width: Math.round(next.width),
                      height: Math.round(next.height),
                    },
              );
              revealIntro();
            }}
          >
            {AMBIENT.map((wash, index) => (
              <AmbientWash
                key={`wash-${index}`}
                wash={wash}
                index={index}
                screenWidth={width}
                screenHeight={height}
                animate={animateBackdrop}
              />
            ))}

            <Vignette width={width} height={height} />

            <View
              pointerEvents="none"
              style={[
                styles.logoSlot,
                {
                  width: logoWidth,
                  height: logoHeight,
                  left: (width - logoWidth) / 2,
                  top: height * LOGO_CENTER_Y - logoHeight / 2,
                },
              ]}
            >
              <Animated.View style={[{ width: logoWidth, height: logoHeight }, logoStyle]}>
                <Animated.View
                  style={[
                    styles.glowWrap,
                    {
                      width: glowSize,
                      height: glowSize,
                      left: sparkleCx - glowSize / 2,
                      top: sparkleCy - glowSize / 2,
                    },
                    glowStyle,
                  ]}
                >
                  <SoftBloom size={glowSize} />
                </Animated.View>
                <Image
                  source={LOGO}
                  style={{ width: logoWidth, height: logoHeight }}
                  contentFit="contain"
                  accessibilityLabel="Arcanyx"
                />
              </Animated.View>
            </View>

            <Pressable style={styles.layer} onPress={skip} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * A single soft wash of light. Drifts, breathes and rotates on its own clock so
 * the backdrop never settles into a symmetrical shape — slow enough that you
 * read it as depth rather than as movement.
 */
function AmbientWash({
  wash,
  index,
  screenWidth,
  screenHeight,
  animate,
}: {
  wash: (typeof AMBIENT)[number];
  index: number;
  screenWidth: number;
  screenHeight: number;
  animate: boolean;
}) {
  const progress = useSharedValue(0);
  const span = Math.max(screenWidth, screenHeight);
  const w = screenWidth * wash.size;
  const h = w * wash.ratio;
  const driftX = span * wash.drift.x;
  const driftY = span * wash.drift.y;

  useEffect(() => {
    if (!animate) return;
    progress.value = withDelay(
      wash.delay,
      withRepeat(
        withTiming(1, {
          duration: wash.duration,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(progress);
  }, [animate, wash.delay, wash.duration, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [0, driftX]) },
      { translateY: interpolate(progress.value, [0, 1], [0, driftY]) },
      { scale: interpolate(progress.value, [0, 1], [0.94, 1.06]) },
      { rotate: `${interpolate(progress.value, [0, 1], [0, wash.drift.rotate])}deg` },
    ],
  }));

  const gradientId = `introWash${index}`;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wash,
        {
          width: w,
          height: h,
          left: screenWidth * wash.x - w / 2,
          top: screenHeight * wash.y - h / 2,
        },
        style,
      ]}
    >
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={AMBIENT_COLOR} stopOpacity={wash.opacity} />
            <Stop offset="45%" stopColor={AMBIENT_COLOR} stopOpacity={wash.opacity * 0.42} />
            <Stop offset="75%" stopColor={AMBIENT_COLOR} stopOpacity={wash.opacity * 0.13} />
            <Stop offset="100%" stopColor={AMBIENT_COLOR} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

/** Pulls the edges back to near-black so the washes read as light, not panels. */
function Vignette({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={styles.layer} pointerEvents="none">
      <Defs>
        <RadialGradient id="introVignette" cx="40%" cy="43%" r="72%">
          <Stop offset="0%" stopColor={INTRO_BG} stopOpacity={0} />
          <Stop offset="58%" stopColor={INTRO_BG} stopOpacity={0.14} />
          <Stop offset="100%" stopColor={INTRO_BG} stopOpacity={0.92} />
        </RadialGradient>
        <SvgLinearGradient id="introFloor" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={INTRO_BG} stopOpacity={0} />
          <Stop offset="100%" stopColor={INTRO_BG} stopOpacity={0.7} />
        </SvgLinearGradient>
      </Defs>
      <Rect width={width} height={height} fill="url(#introVignette)" />
      <Rect y={height * 0.7} width={width} height={height * 0.3} fill="url(#introFloor)" />
    </Svg>
  );
}

/** Whisper of lavender behind the A, picked from the wordmark's own violet. */
function SoftBloom({ size }: { size: number }) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="introBloomWide" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#E9E0FA" stopOpacity={0.17} />
          <Stop offset="28%" stopColor="#A890C0" stopOpacity={0.1} />
          <Stop offset="100%" stopColor="#9060A8" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="introBloomCore" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#F3ECFF" stopOpacity={0.34} />
          <Stop offset="40%" stopColor="#C0A8D8" stopOpacity={0.14} />
          <Stop offset="100%" stopColor="#C0A8D8" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#introBloomWide)" />
      <Rect
        x={size * 0.32}
        y={size * 0.32}
        width={size * 0.36}
        height={size * 0.36}
        fill="url(#introBloomCore)"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: INTRO_BG,
  },
  fade: {
    flex: 1,
    backgroundColor: INTRO_BG,
  },
  canvas: {
    flex: 1,
    overflow: "hidden",
  },
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  wash: {
    position: "absolute",
  },
  logoSlot: {
    position: "absolute",
  },
  glowWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
});
