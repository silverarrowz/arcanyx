import type { SvgProps } from "react-native-svg";
import Svg, { G, Path } from "react-native-svg";

export type TabSvgIconProps = SvgProps & {
  color?: string;
  size?: number;
};

function iconBox(props: {
  size?: number;
  width?: number | string;
  height?: number | string;
}) {
  const w =
    typeof props.width === "number"
      ? props.width
      : typeof props.height === "number"
        ? props.height
        : (props.size ?? 20);
  return { width: w, height: w };
}

/** Bump this to make filled icons read bolder (outline matches fill color). */
const OUTLINE_WIDTH_SCALE = 4;

/**
 * Lucide passes a small "strokeWidth" (e.g. 1.6–2). Our assets are huge-coordinate filled paths
 * scaled by 0.1; convert the Lucide-ish stroke into path user units so the icon reads thicker.
 */
function outlineWidth(
  strokeWidth: number | string | undefined,
  viewBoxWidth: number,
  pxSize: number,
) {
  if (strokeWidth === undefined || strokeWidth === null) return 0;
  const n = typeof strokeWidth === "string" ? Number(strokeWidth) : strokeWidth;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return ((n * viewBoxWidth) / pxSize) * OUTLINE_WIDTH_SCALE;
}

export function HomeTabIcon({
  color = "currentColor",
  size = 20,
  strokeWidth,
  width,
  height,
  ...props
}: TabSvgIconProps) {
  const box = iconBox({ size, width, height });
  const outline = outlineWidth(strokeWidth, 208.17, box.width);

  return (
    <Svg
      viewBox="1.8 1.89 208.17 209.11"
      preserveAspectRatio="xMidYMid meet"
      {...props}
      width={width ?? box.width}
      height={height ?? box.height}
    >
      <G transform="translate(0 212) scale(0.1 -0.1)">
        {[
          "M1010 2085 c-14 -8 -243 -235 -508 -505 -462 -469 -484 -492 -484 -527 0 -53 26 -70 117 -78 l75 -7 0 -439 0 -439 34 -38 34 -37 254 -3 c139 -2 272 0 296 3 l42 6 0 237 c0 142 5 253 11 277 6 22 28 56 48 76 86 87 225 70 285 -34 23 -40 24 -53 31 -297 3 -140 9 -258 11 -262 3 -4 129 -8 280 -8 224 0 280 3 304 15 62 32 60 17 60 501 l0 442 80 7 c69 6 83 11 100 32 41 53 25 85 -114 223 l-106 105 0 242 c0 156 -4 251 -11 266 -17 38 -50 47 -168 47 -145 0 -157 -8 -167 -121 l-7 -81 -206 206 c-222 221 -229 226 -291 191z m559 -534 c329 -334 479 -494 475 -504 -4 -11 -28 -17 -84 -22 -44 -4 -84 -13 -89 -19 -7 -8 -13 -182 -17 -459 -7 -425 -8 -448 -27 -464 -17 -16 -45 -18 -276 -18 l-256 0 -4 245 c-3 268 -7 285 -68 341 -48 45 -90 61 -162 61 -79 0 -124 -17 -169 -62 -65 -65 -67 -71 -72 -340 l-5 -245 -258 0 -259 0 -19 24 c-18 22 -19 45 -19 461 0 488 3 468 -68 472 -20 1 -51 2 -68 3 -39 3 -54 12 -54 33 0 9 217 234 482 499 391 391 488 483 509 483 21 0 116 -92 508 -489z m225 273 c14 -13 16 -48 16 -227 l0 -212 -125 125 -125 125 0 87 c0 115 3 118 125 118 72 0 97 -4 109 -16z",
          "M1048 1428 c-9 -7 -19 -29 -22 -48 -13 -76 -67 -129 -153 -151 -64 -17 -59 -43 14 -64 70 -20 116 -64 133 -125 7 -25 14 -51 16 -57 2 -7 12 -13 22 -13 15 0 22 11 31 43 22 87 65 131 149 152 33 9 48 18 50 31 2 15 -9 22 -59 37 -78 23 -113 57 -134 133 -20 70 -26 78 -47 62z m34 -158 c10 -17 31 -38 48 -48 38 -21 38 -28 -1 -47 -17 -9 -40 -32 -51 -51 l-21 -36 -20 35 c-11 20 -35 44 -54 54 -18 9 -33 20 -33 23 0 4 16 14 35 23 19 9 41 30 50 47 19 37 26 37 47 0z",
        ].map((d, i) => (
          <Path
            key={i}
            d={d}
            fill={color}
            stroke={outline > 0 ? color : "none"}
            strokeWidth={outline > 0 ? outline : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </G>
    </Svg>
  );
}

export function DreamTabIcon({
  color = "currentColor",
  size = 20,
  strokeWidth,
  width,
  height,
  ...props
}: TabSvgIconProps) {
  const box = iconBox({ size, width, height });
  const outline = outlineWidth(strokeWidth, 210.02, box.width);

  return (
    <Svg
      viewBox="2.85 4.27 210.02 189.94"
      preserveAspectRatio="xMidYMid meet"
      {...props}
      width={width ?? box.width}
      height={height ?? box.height}
    >
      <G transform="translate(0 196) scale(0.1 -0.1)">
        {[
          "M1066 1899 c-97 -24 -246 -93 -330 -153 -125 -90 -247 -237 -316 -381 -90 -188 -110 -469 -50 -679 l19 -68 -36 -54 c-36 -54 -36 -54 -87 -54 -98 0 -202 -74 -226 -160 -38 -135 20 -264 143 -315 55 -23 1251 -23 1365 1 219 45 429 185 538 360 67 107 55 140 -35 95 -53 -28 -182 -58 -276 -66 -94 -8 -206 6 -316 41 -242 76 -439 279 -515 529 -25 80 -28 106 -28 235 0 136 2 151 31 238 17 51 50 124 73 163 45 76 168 207 219 233 20 11 31 23 29 34 -5 25 -104 26 -202 1z m37 -86 c-187 -183 -279 -476 -229 -735 52 -271 222 -496 464 -614 229 -111 465 -121 706 -28 18 7 18 4 -4 -27 -139 -198 -401 -338 -632 -339 l-68 0 16 34 c22 46 11 98 -29 142 -26 28 -44 37 -94 47 -51 9 -63 15 -68 34 -8 35 -65 94 -110 114 -22 10 -63 19 -91 19 -48 0 -52 2 -59 28 -10 42 -62 117 -102 148 -88 67 -212 83 -315 40 l-58 -24 -14 49 c-41 136 -45 317 -11 469 19 85 95 251 149 325 90 124 237 245 374 307 60 27 187 66 221 67 7 1 -13 -25 -46 -56z m-434 -1164 c93 -20 183 -112 198 -202 7 -45 18 -52 67 -39 69 20 159 -30 186 -100 22 -61 24 -62 73 -59 25 1 56 -3 69 -9 60 -31 76 -98 35 -146 l-24 -27 -499 -3 c-315 -1 -517 1 -548 8 -68 14 -129 75 -145 146 -32 131 73 258 208 252 64 -3 71 -2 71 13 0 22 55 92 95 123 34 25 106 52 147 53 9 1 40 -4 67 -10z",
          "M1687 1503 c-3 -10 -11 -40 -18 -67 -18 -70 -67 -116 -149 -141 -78 -24 -85 -44 -20 -62 116 -33 153 -68 175 -167 17 -76 40 -70 70 19 28 84 62 118 142 141 32 9 61 18 65 21 17 10 -8 34 -45 44 -61 16 -112 44 -130 72 -8 13 -24 53 -34 88 -19 64 -46 89 -56 52z m43 -153 c12 -24 36 -48 60 -62 22 -13 40 -25 40 -28 0 -3 -15 -12 -33 -21 -17 -8 -46 -36 -63 -61 l-31 -45 -22 42 c-14 26 -38 51 -63 65 l-41 23 37 19 c22 11 49 38 64 63 15 25 28 45 29 45 2 0 12 -18 23 -40z",
          "M1977 809 l-28 -29 28 -28 c27 -27 53 -32 53 -10 0 5 10 18 23 28 22 18 22 19 2 26 -11 5 -27 16 -35 25 -14 17 -17 16 -43 -12z",
        ].map((d, i) => (
          <Path
            key={i}
            d={d}
            fill={color}
            stroke={outline > 0 ? color : "none"}
            strokeWidth={outline > 0 ? outline : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </G>
    </Svg>
  );
}

export function DiaryTabIcon({
  color = "currentColor",
  size = 20,
  strokeWidth,
  width,
  height,
  ...props
}: TabSvgIconProps) {
  const box = iconBox({ size, width, height });
  const outline = outlineWidth(strokeWidth, 165.5, box.width);

  return (
    <Svg
      viewBox="2.5 10.62 165.5 149.73"
      preserveAspectRatio="xMidYMid meet"
      {...props}
      width={width ?? box.width}
      height={height ?? box.height}
    >
      <G transform="translate(0 181) scale(0.1 -0.1)">
        {[
          "M285 1700 c-109 -10 -135 -32 -135 -114 0 -44 -1 -46 -30 -46 -19 0 -42 -11 -62 -29 l-33 -29 0 -481 0 -481 26 -26 26 -25 342 -6 c338 -6 342 -6 373 -30 42 -30 88 -30 126 2 17 14 39 25 51 25 18 0 21 -6 21 -42 0 -94 13 -208 24 -208 6 0 31 13 55 29 l44 30 53 -34 c29 -18 55 -31 58 -28 3 4 6 61 6 128 l0 122 203 7 c200 6 202 6 225 32 l22 25 0 478 c0 469 0 479 -21 505 -13 17 -34 28 -60 32 -38 6 -39 8 -39 46 0 56 -23 94 -65 108 -50 16 -239 14 -306 -4 -130 -35 -237 -103 -300 -191 l-34 -47 -14 24 c-8 12 -41 49 -73 80 -118 115 -287 167 -483 148z m206 -44 c92 -20 191 -71 253 -130 95 -93 91 -65 94 -593 1 -255 0 -463 -4 -463 -3 0 -28 19 -54 43 -109 98 -240 139 -437 136 -93 -1 -138 2 -146 10 -18 18 -17 965 1 983 27 27 193 35 293 14z m963 5 c26 -5 52 -14 57 -22 14 -23 11 -976 -3 -985 -7 -4 -69 -7 -138 -5 -92 2 -144 -2 -195 -15 -90 -22 -195 -75 -249 -125 -24 -21 -46 -39 -50 -39 -3 0 -6 204 -6 453 0 425 2 455 20 495 30 65 67 108 131 151 126 85 280 117 433 92z m-1304 -584 c0 -418 0 -424 21 -443 19 -17 38 -19 173 -20 115 -1 164 -5 206 -19 63 -20 166 -70 175 -85 4 -7 -97 -10 -309 -10 -303 0 -317 1 -336 20 -19 19 -20 33 -20 482 0 509 -1 498 62 498 l28 0 0 -423z m1484 401 c14 -20 16 -81 16 -471 0 -446 -2 -478 -34 -499 -6 -4 -152 -8 -325 -8 -349 0 -349 0 -221 59 98 45 210 64 337 55 100 -6 102 -6 127 19 l26 26 0 421 0 420 29 0 c20 0 35 -8 45 -22z m-434 -1118 c0 -55 -2 -100 -6 -100 -3 0 -21 11 -42 25 l-36 25 -43 -26 -43 -25 0 101 0 100 85 0 85 0 0 -100z",
          "M1200 1198 c-12 -35 -24 -47 -60 -66 -55 -27 -60 -38 -21 -47 38 -8 77 -47 85 -85 6 -31 36 -43 36 -15 0 37 32 77 77 96 50 22 49 30 -10 49 -37 11 -52 32 -71 93 -9 28 -21 20 -36 -25z m49 -72 l22 -23 -23 -26 -23 -26 -26 25 -27 26 22 23 c27 29 28 29 55 1z",
        ].map((d, i) => (
          <Path
            key={i}
            d={d}
            fill={color}
            stroke={outline > 0 ? color : "none"}
            strokeWidth={outline > 0 ? outline : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </G>
    </Svg>
  );
}
