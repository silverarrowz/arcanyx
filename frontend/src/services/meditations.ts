import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiBaseUrl, apiFetch } from "./api";

const CATALOG_CACHE_KEY = "@mystix_meditations_catalog_v1";

export type Meditation = {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  durationSec: number;
  audioFile: string | null;
  coverFile: string | null;
  audioUrl?: string | null;
  coverUrl?: string | null;
  hasAudio: boolean;
  hasCover: boolean;
  version?: string;
  audioRev?: string;
  coverRev?: string;
  sort: number;
};

export type MeditationList = {
  items: Meditation[];
  tags: string[];
};

export function meditationAudioUrl(
  item: Meditation,
): string | null {
  if (!item.audioFile && !item.hasAudio) return null;
  const base =
    item.audioUrl ||
    `${apiBaseUrl()}/api/meditations/${encodeURIComponent(item.slug)}/audio`;
  // Direct S3 objects already have unique keys; extra query params are only
  // useful on the API proxy, which iOS otherwise caches too aggressively.
  if (/[?&]v=/.test(base) || /s3\.twcstorage\.ru/i.test(base)) return base;
  const rev = item.version || item.audioRev || String(item.durationSec || 0);
  if (!rev) return base;
  return `${base}${base.includes("?") ? "&" : "?"}v=${encodeURIComponent(rev)}`;
}

export function meditationCoverUrl(item: Meditation): string | null {
  if (!item.hasCover && !item.coverFile) return null;
  const base =
    item.coverUrl ||
    `${apiBaseUrl()}/api/meditations/${encodeURIComponent(item.slug)}/cover`;
  if (!item.coverRev || /[?&]v=/.test(base)) return base;
  return `${base}${base.includes("?") ? "&" : "?"}v=${encodeURIComponent(item.coverRev)}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

async function readCatalogCache(): Promise<MeditationList | null> {
  try {
    const raw = await AsyncStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MeditationList;
    if (!Array.isArray(parsed?.items) || !Array.isArray(parsed?.tags)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function readCachedMeditations(): Promise<MeditationList | null> {
  return readCatalogCache();
}

function catalogPath(path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}_=${Date.now()}`;
}

export async function fetchMeditations(): Promise<MeditationList> {
  const data = await apiFetch<MeditationList>(catalogPath("/api/meditations"), {
    timeoutMs: 12000,
    retries: 1,
    cache: "no-store",
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
  if (Array.isArray(data?.items) && Array.isArray(data?.tags)) {
    AsyncStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(data)).catch(() => {});
  }
  return data;
}

export async function fetchMeditation(slug: string): Promise<Meditation> {
  return apiFetch<Meditation>(
    catalogPath(`/api/meditations/${encodeURIComponent(slug)}`),
    {
      timeoutMs: 8000,
      retries: 0,
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    },
  );
}
