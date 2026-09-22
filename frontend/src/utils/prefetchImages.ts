import { Image } from "expo-image";

/** Local bitmaps that appear on first-open screens. Metro dedupes these with screen requires. */
const WARM_IMAGES = [
  require("../../assets/home/logo.png"),
  require("../../assets/oracle/ball2.jpg"),
  require("../../assets/oracle/bg1.jpg"),
  require("../../assets/oracle/bg2.jpg"),
  require("../../assets/oracle/bg3.jpg"),
  require("../../assets/home/bg-main3.jpg"),
  require("../../assets/home/bg-energy.jpg"),
  require("../../assets/home/bg-main-bottom.jpg"),
  require("../../assets/tarot/card-back2.png"),
  require("../../assets/tarot/bg/bgi1.jpg"),
];

function warm(sources: number[]): void {
  void Promise.all(
    sources.map((source) => Image.loadAsync(source).catch(() => null)),
  );
}

/** Decode key local images into expo-image's memory cache. Safe to fire-and-forget. */
export function prefetchAppImages(): void {
  warm(WARM_IMAGES);
}

/** Remaining spread cards — call when Гадания mounts so Таро is ready. */
export function prefetchTarotSpreadImages(remoteUrls: string[] = []): void {
  if (remoteUrls.length > 0) {
    void Image.prefetch(remoteUrls).catch(() => null);
  }
}
