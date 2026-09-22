import { Platform, Share, type RefObject, type View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(ready: () => boolean, timeoutMs: number) {
  const start = Date.now();
  while (!ready() && Date.now() - start < timeoutMs) {
    await wait(40);
  }
}

export async function shareViewAsImage(
  viewRef: RefObject<View | null>,
  fallbackText: string,
  imageReady?: () => boolean,
  dialogTitle = "Поделиться",
): Promise<void> {
  const shareText = async () => {
    await Share.share({ message: fallbackText });
  };

  if (Platform.OS === "web" || !viewRef.current) {
    await shareText();
    return;
  }

  if (imageReady) {
    await waitUntil(imageReady, 2200);
  }
  await wait(80);

  try {
    const uri = await captureRef(viewRef, {
      format: "jpg",
      quality: 0.92,
      result: "tmpfile",
      pixelRatio: 3,
      fileName: "arcanyx-card",
      useRenderInContext: true,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "image/jpeg",
        UTI: "public.jpeg",
        dialogTitle,
      });
      return;
    }
  } catch {
    // Fall through to a text share so the button still does something.
  }

  await shareText();
}
