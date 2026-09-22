import { Platform } from "react-native";

export const theme = {
  colors: {
    bg: "#121022",
    bgSecondary: "#1B1830",
    surface: "#231F3A",
    surfaceStrong: "#302852",
    surfaceMuted: "#1A172B",
    surfaceGlass: "rgba(35,31,58,0.78)",
    border: "rgba(255,255,255,0.10)",
    borderStrong: "rgba(255,255,255,0.18)",
    borderGold: "rgba(255,217,154,0.38)",
    borderPurple: "rgba(193,155,255,0.28)",
    gold: "#FFD79A",
    goldDeep: "#EFB77A",
    goldSoft: "rgba(255,215,154,0.16)",
    purple: "#9D7CE6",
    purpleDeep: "#352B62",
    purpleSoft: "rgba(157,124,230,0.16)",
    mauve: "#C47BEA",
    mauveSoft: "rgba(196,123,234,0.18)",
    pink: "#EFA0C0",
    pinkSoft: "rgba(239,160,192,0.18)",
    lilac: "#CFC6E8",
    text: "#FFF7EA",
    textDim: "#B5AEC9",
    textMuted: "#7C7696",
    ink: "#151226",
    success: "#10B981",
    danger: "#EF4444",
    /**
     * Editorial palette from the Arcanyx visual archive: near-black paper, one
     * lavender accent, neutral greys. Deliberately colder and flatter than the
     * mystical palette above — for archive/index surfaces, not for cards.
     */
    archive: {
      paper: "#0C0B11",
      paperLift: "#13111E",
      headline: "#F3EDF9",
      accent: "#C9A8FF",
      body: "#BFBCC5",
      label: "#98959E",
      rule: "rgba(243,237,249,0.11)",
    },
  },
  gradients: {
    background: ["#121022", "#1B1730", "#271D46"],
    surface: ["rgba(48,40,82,0.92)", "rgba(25,22,43,0.94)"],
    primary: ["#F0A0C6", "#9D7CE6"],
    warm: ["#FFD79A", "#EFA0C0"],
    oracle: ["#33245E", "#7B4CC2", "#EFA0C0"],
    cardBack: ["#33285C", "#1B1830", "#121022"],
    /** Главные CTA (главная, оракул): розово‑лавандовый тройной градиент. */
    primaryCta: ["#EFA0C0", "#B98BE5", "#9D7CE6"] as [string, string, string],
    primaryCtaMuted: ["#756A8F", "#7D7494", "#847888"] as [string, string, string],
  },
  radius: {
    sm: 12,
    md: 18,
    lg: 28,
    xl: 36,
    pill: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  fonts: {
    heading: "CormorantGaramond_600SemiBold",
    headingItalic: "CormorantGaramond_600SemiBold_Italic",
    headingBold: "CormorantGaramond_700Bold",
    headingBoldItalic: "CormorantGaramond_700Bold_Italic",
    body: "Manrope_400Regular",
    bodyMedium: "Manrope_500Medium",
    bodySemi: "Manrope_600SemiBold",
    display: "YesevaOne_400Regular",
    /**
     * The archive's serif. Iowan Old Style ships with iOS; elsewhere we fall
     * back to the Cormorant that's already bundled — the closest old-style
     * face we have. Pair `editorialItalic` with `editorialItalicStyle`, since
     * the Cormorant fallback is already slanted and must not be skewed again.
     */
    editorialSerif: Platform.select({
      ios: "Iowan Old Style",
      default: "CormorantGaramond_600SemiBold",
    }) as string,
    editorialItalic: Platform.select({
      ios: "Iowan Old Style",
      default: "CormorantGaramond_600SemiBold_Italic",
    }) as string,
  },
  /** `"italic"` only where the italic comes from a synthesized face. */
  editorialItalicStyle: Platform.select({
    ios: "italic",
    default: "normal",
  }) as "italic" | "normal",
  shadows: {
    card: {
      shadowColor: "#05030D",
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.32,
      shadowRadius: 28,
      elevation: 10,
    },
    glowPurple: {
      shadowColor: "#9D7CE6",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.28,
      shadowRadius: 24,
      elevation: 12,
    },
    glowGold: {
      shadowColor: "#FFD79A",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.22,
      shadowRadius: 20,
      elevation: 10,
    },
    /** Свечение розово‑лавандовое вокруг основных CTA (главная, оракул). */
    ctaPrimary: {
      shadowColor: "#F5B8D4",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.52,
      shadowRadius: 8,
      elevation: 8,
    },
    /** Приглушённое свечение — заблокированный CTA / loading оракула. */
    ctaMuted: {
      shadowColor: "#E598BE",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.32,
      shadowRadius: 18,
      elevation: 9,
    },
  },
};
