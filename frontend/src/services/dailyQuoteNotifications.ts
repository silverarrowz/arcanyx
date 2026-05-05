import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { formatDailyQuotePlain, getDailyQuote } from "../data/dailyQuotes";
import { todayKey } from "../hooks/useDailyCard";

const STORAGE_KEY = "@daily_quote_notifications_v1";
const ANDROID_CHANNEL_ID = "daily-quote";
const SCHEDULE_HORIZON_DAYS = 30;
const NOTIFICATION_HOUR = 9;
const NOTIFICATION_MINUTE = 0;

type StoredSchedule = {
  preparedOnDay: string;
  ids: string[];
};

function notificationDateForOffset(base: Date, dayOffset: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(NOTIFICATION_HOUR, NOTIFICATION_MINUTE, 0, 0);
  return d;
}

function parseStoredSchedule(raw: string | null): StoredSchedule | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSchedule>;
    if (!parsed || typeof parsed.preparedOnDay !== "string" || !Array.isArray(parsed.ids)) {
      return null;
    }
    const ids = parsed.ids.filter((id): id is string => typeof id === "string" && id.length > 0);
    return {
      preparedOnDay: parsed.preparedOnDay,
      ids,
    };
  } catch {
    return null;
  }
}

async function prepareAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Цитата дня",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 120, 80, 120],
    lightColor: "#9D7CE6",
  });
}

async function ensurePermissions(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted || asked.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function syncDailyQuoteNotifications(): Promise<void> {
  await prepareAndroidChannel();
  const hasPermissions = await ensurePermissions();
  if (!hasPermissions) return;

  const now = new Date();
  const dayKey = todayKey(now);
  const stored = parseStoredSchedule(await AsyncStorage.getItem(STORAGE_KEY));

  if (stored?.preparedOnDay === dayKey && stored.ids.length > 0) {
    return;
  }

  if (stored?.ids.length) {
    await Promise.allSettled(
      stored.ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
    );
  }

  const nextIds: string[] = [];
  for (let offset = 0; offset < SCHEDULE_HORIZON_DAYS; offset += 1) {
    const triggerDate = notificationDateForOffset(now, offset);
    if (triggerDate.getTime() <= now.getTime()) continue;

    const quoteDayKey = todayKey(triggerDate);
    const entry = getDailyQuote(quoteDayKey);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Цитата дня",
        body: formatDailyQuotePlain(entry),
        sound: "default",
        data: {
          kind: "daily-quote",
          dayKey: quoteDayKey,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : {}),
      },
    });
    nextIds.push(id);
  }

  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      preparedOnDay: dayKey,
      ids: nextIds,
    } satisfies StoredSchedule),
  );
}
