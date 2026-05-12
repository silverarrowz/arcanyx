import type { ImageSourcePropType } from "react-native";

/** Replace `art-1.png` / `art-2.png` in `assets/tarot/` with your real illustrations (same filenames or update requires). */
const ART_A = require("../../assets/tarot/art-ckn2.png");
const ART_B = require("../../assets/tarot/art-qc.png");

const FRONT_ART: ImageSourcePropType[] = [ART_A, ART_B];

/** Picks one of the two placeholder arts per card (stable for a given id). */
export function frontArtSourceForCardId(cardId: string): ImageSourcePropType {
  let h = 0;
  for (let i = 0; i < cardId.length; i++) {
    h = (h + cardId.charCodeAt(i)) % 997;
  }
  return FRONT_ART[h % FRONT_ART.length];
}
