import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { Heart, Pause, Play, X } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import { theme } from "../src/theme";
import { useMeditationFavorites } from "../src/context/MeditationFavoritesContext";
import {
  fetchMeditation,
  formatDuration,
  meditationAudioUrl,
  meditationCoverUrl,
  readCachedMeditations,
  type Meditation,
} from "../src/services/meditations";

const FALLBACK_COVER = require("../assets/home/bg-energy.jpg");

const PLAYBACK_MODE = {
  playsInSilentMode: true,
  allowsRecording: false,
  interruptionMode: "doNotMix" as const,
  shouldPlayInBackground: true,
};

async function ensurePlaybackMode() {
  await setAudioModeAsync(PLAYBACK_MODE);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const LOADER_SIZE = 42;
const LOADER_STROKE = 3.5;
const LOADER_RADIUS = (LOADER_SIZE - LOADER_STROKE) / 2;
const LOADER_CIRCUMFERENCE = 2 * Math.PI * LOADER_RADIUS;

function FillingAudioLoader() {
  const [fill] = useState(() => new Animated.Value(0.06));

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(fill, {
        toValue: 0.55,
        duration: 1800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(fill, {
        toValue: 0.94,
        duration: 8000,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [fill]);

  const strokeDashoffset = fill.interpolate({
    inputRange: [0, 1],
    outputRange: [LOADER_CIRCUMFERENCE, 0],
  });

  return (
    <Svg
      width={LOADER_SIZE}
      height={LOADER_SIZE}
      viewBox={`0 0 ${LOADER_SIZE} ${LOADER_SIZE}`}
    >
      <Circle
        cx={LOADER_SIZE / 2}
        cy={LOADER_SIZE / 2}
        r={LOADER_RADIUS}
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={LOADER_STROKE}
      />
      <AnimatedCircle
        cx={LOADER_SIZE / 2}
        cy={LOADER_SIZE / 2}
        r={LOADER_RADIUS}
        fill="none"
        stroke={theme.colors.text}
        strokeWidth={LOADER_STROKE}
        strokeLinecap="round"
        strokeDasharray={`${LOADER_CIRCUMFERENCE} ${LOADER_CIRCUMFERENCE}`}
        strokeDashoffset={strokeDashoffset}
        rotation="-90"
        origin={`${LOADER_SIZE / 2}, ${LOADER_SIZE / 2}`}
      />
    </Svg>
  );
}

function MeditationTransport({
  audioUrl,
  item,
}: {
  audioUrl: string;
  item: Meditation;
}) {
  const player = useAudioPlayer(
    { uri: audioUrl },
    {
      updateInterval: 250,
      downloadFirst: false,
      keepAudioSessionActive: true,
    },
  );
  const status = useAudioPlayerStatus(player);
  const audioReady = status.isLoaded || status.duration > 0;
  const [barWidth, setBarWidth] = useState(1);
  const autoPlayedFor = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      try {
        player.clearLockScreenControls();
      } catch {
        // ignore
      }
    };
  }, [player]);

  useEffect(() => {
    if (!audioReady) return;
    try {
      player.setActiveForLockScreen(
        true,
        {
          title: item.title,
          artist: "Arcanyx",
          albumTitle: "Медитации",
          artworkUrl: meditationCoverUrl(item) ?? undefined,
        },
        {
          showSeekForward: true,
          showSeekBackward: true,
          isLiveStream: false,
        },
      );
    } catch {
      // Lock screen controls are optional; playback still continues.
    }
  }, [audioReady, item, player]);

  useEffect(() => {
    if (autoPlayedFor.current === audioUrl) return;
    if (!audioReady) return;
    autoPlayedFor.current = audioUrl;
    ensurePlaybackMode()
      .catch(() => {})
      .finally(() => {
        player.play();
      });
  }, [audioReady, audioUrl, player]);

  const duration = status.duration > 0 ? status.duration : item.durationSec ?? 0;
  const progress = duration > 0 ? clamp01(status.currentTime / duration) : 0;
  const failed = Boolean(status.error);

  const toggle = () => {
    Haptics.selectionAsync().catch(() => {});
    if (failed) {
      autoPlayedFor.current = null;
      player.replace({ uri: audioUrl });
      return;
    }
    if (status.playing) {
      player.pause();
      return;
    }
    ensurePlaybackMode()
      .catch(() => {})
      .finally(() => {
        player.play();
      });
  };

  const seek = (x: number) => {
    if (duration <= 0 || failed) return;
    const next = clamp01(x / barWidth) * duration;
    player.seekTo(next);
  };

  return (
    <View style={styles.player}>
      <Pressable
        onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
        onPress={(event) => seek(event.nativeEvent.locationX)}
        style={styles.barHit}
      >
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
          <View style={[styles.barKnob, { left: `${progress * 100}%` }]} />
        </View>
      </Pressable>
      <View style={styles.timeRow}>
        <Text style={styles.time}>
          {formatDuration(status.currentTime) || "0:00"}
        </Text>
        <Text style={styles.time}>{formatDuration(duration) || "--:--"}</Text>
      </View>
      {failed ? (
        <Text style={styles.audioError}>
          Не удалось начать воспроизведение. Нажмите ещё раз, чтобы повторить.
        </Text>
      ) : null}
      <Pressable onPress={toggle} style={styles.playBtn}>
        <LinearGradient
          colors={[...theme.gradients.primaryCta]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.playGrad}
        >
          {status.playing ? (
            <Pause color={theme.colors.text} size={26} strokeWidth={1.7} />
          ) : !audioReady && !failed ? (
            <FillingAudioLoader />
          ) : (
            <Play
              color={theme.colors.text}
              size={26}
              strokeWidth={1.7}
              style={styles.playIcon}
            />
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

export default function MeditationPlayerScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const [item, setItem] = useState<Meditation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [coverFailed, setCoverFailed] = useState(false);
  const [descOpen, setDescOpen] = useState(true);
  const { isFavorite, isToggling, toggleFavorite } = useMeditationFavorites();

  const audioUrl = useMemo(
    () => (item ? meditationAudioUrl(item) : null),
    [item],
  );

  useEffect(() => {
    ensurePlaybackMode().catch(() => {});
  }, []);

  useEffect(() => {
    if (!slug) {
      return;
    }
    let cancelled = false;

    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setError(null);
      setCoverFailed(false);
      setDescOpen(true);

      const cached = await readCachedMeditations();
      const cachedItem =
        cached?.items.find((entry) => entry.slug === slug) ?? null;
      if (!cancelled && cachedItem) {
        setItem(cachedItem);
        setLoading(false);
      } else if (!cancelled) {
        setLoading(true);
      }

      try {
        const data = await fetchMeditation(slug);
        if (!cancelled) {
          setItem(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled && !cachedItem) {
          setError(
            err instanceof Error ? err.message : "Не удалось открыть медитацию",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const coverUri = item ? meditationCoverUrl(item) : null;
  const cover = coverUri && !coverFailed ? { uri: coverUri } : FALLBACK_COVER;
  const tags = useMemo(() => item?.tags ?? [], [item]);
  const description = item?.description?.trim() ?? "";
  const descCollapsible = description.length > 180;

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/meditations");
  };

  return (
    <View style={styles.root}>
      <Image
        source={cover}
        style={styles.cover}
        contentFit="cover"
        contentPosition="center"
        cachePolicy="memory-disk"
        recyclingKey={item?.slug}
        transition={220}
        placeholder={FALLBACK_COVER}
        placeholderContentFit="cover"
        pointerEvents="none"
        onError={() => {
          if (coverUri) setCoverFailed(true);
        }}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[
          "rgba(8,6,18,0.42)",
          "rgba(8,6,18,0.08)",
          "rgba(12,9,24,0.45)",
          "rgba(10,7,20,0.88)",
          "rgba(8,6,16,0.97)",
        ]}
        locations={[0, 0.28, 0.52, 0.78, 1]}
        style={styles.scrim}
      />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} hitSlop={10} style={styles.closeBtn}>
            <X color={theme.colors.text} size={18} strokeWidth={1.8} />
          </Pressable>
          {item ? (
            <Pressable
              hitSlop={10}
              disabled={isToggling(item.slug)}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                void toggleFavorite(item.slug).catch(() => {});
              }}
              accessibilityRole="button"
              accessibilityLabel={
                isFavorite(item.slug)
                  ? "Убрать из избранного"
                  : "Добавить в избранное"
              }
              style={({ pressed }) => [
                styles.favoriteBtn,
                pressed && { transform: [{ scale: 0.94 }] },
                isToggling(item.slug) && { opacity: 0.55 },
              ]}
            >
              <Heart
                color={
                  isFavorite(item.slug) ? theme.colors.gold : theme.colors.text
                }
                size={19}
                strokeWidth={1.8}
                fill={isFavorite(item.slug) ? theme.colors.gold : "none"}
              />
            </Pressable>
          ) : null}
        </View>

        {!slug ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Медитация не найдена</Text>
          </View>
        ) : !item && loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.gold} />
          </View>
        ) : error || !item ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>{error || "Медитация не найдена"}</Text>
          </View>
        ) : (
          <View style={styles.dock}>
            <ScrollView
              style={styles.descScroll}
              contentContainerStyle={styles.descScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={descCollapsible}
            >
              <Text style={styles.title}>{item.title}</Text>
              {description ? (
                <Pressable
                  onPress={() => {
                    if (!descCollapsible) return;
                    Haptics.selectionAsync().catch(() => {});
                    setDescOpen((open) => !open);
                  }}
                  disabled={!descCollapsible}
                  accessibilityRole={descCollapsible ? "button" : undefined}
                >
                  <Text
                    style={styles.description}
                    numberOfLines={descOpen || !descCollapsible ? undefined : 3}
                  >
                    {description}
                  </Text>
                  {descCollapsible ? (
                    <Text style={styles.descToggle}>
                      {descOpen ? "свернуть" : "читать полностью"}
                    </Text>
                  ) : null}
                </Pressable>
              ) : null}
              {tags.length > 0 ? (
                <View style={styles.tags}>
                  {tags.map((name) => (
                    <View key={name} style={styles.tag}>
                      <Text style={styles.tagText}>{name}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
            {!audioUrl ? (
              <Text style={styles.missing}>
                Аудиофайл ещё не найден. Имя в каталоге должно совпадать с файлом в бакете.
              </Text>
            ) : (
              <MeditationTransport audioUrl={audioUrl} item={item} />
            )}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  /** Обложка, затемнение и контент — три явных слоя, чтобы порядок не зависел от платформы. */
  cover: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 0 },
  scrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 1 },
  safe: { flex: 1, zIndex: 2 },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dock: {
    marginTop: "auto",
    width: "100%",
    paddingHorizontal: 24,
    paddingBottom: 12,
    alignItems: "center",
  },
  descScroll: {
    width: "100%",
    flexGrow: 0,
    maxHeight: 280,
  },
  descScrollContent: {
    alignItems: "center",
    paddingBottom: 4,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(12,9,24,0.38)",
  },
  favoriteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(12,9,24,0.38)",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: {
    fontFamily: theme.fonts.display,
    color: theme.colors.text,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: 0.2,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 16,
  },
  description: {
    marginTop: 10,
    color: "rgba(255,247,234,0.82)",
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 340,
  },
  descToggle: {
    marginTop: 6,
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  tag: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(12,9,24,0.28)",
  },
  tagText: {
    color: "rgba(255,247,234,0.88)",
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  missing: {
    marginTop: 28,
    color: theme.colors.textDim,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  player: {
    marginTop: 28,
    width: "100%",
    alignItems: "center",
  },
  barHit: { width: "100%", paddingVertical: 14 },
  barTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    overflow: "visible",
    justifyContent: "center",
  },
  barFill: {
    height: "100%",
    backgroundColor: theme.colors.gold,
    borderRadius: 2,
  },
  barKnob: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
    backgroundColor: theme.colors.gold,
    shadowColor: theme.colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
  },
  timeRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -2,
    marginBottom: 22,
  },
  time: {
    color: "rgba(255,247,234,0.62)",
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  audioError: {
    marginTop: -12,
    marginBottom: 16,
    color: "rgba(255,247,234,0.78)",
    fontFamily: theme.fonts.body,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 280,
  },
  playBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    overflow: "hidden",
    shadowColor: theme.colors.mauve,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 20,
    elevation: 10,
  },
  playGrad: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: {
    marginLeft: 3,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.headingBold,
    fontSize: 18,
    textAlign: "center",
  },
});
