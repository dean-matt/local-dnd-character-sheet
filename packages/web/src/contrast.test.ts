import { describe, expect, it } from "vitest";

/**
 * WCAG 2 contrast, computed from OKLCH/OKLab so the gray-scale tokens can be taken
 * straight from Tailwind's palette (node_modules/tailwindcss/theme.css) rather than
 * eyeballed hex. Contrast holding in both themes needs to stay a checked property
 * rather than a one-time claim, so a future repalette that regresses it fails here
 * instead of shipping unnoticed.
 */

type Vec3 = [number, number, number];

function oklabToLinearSRGB(l: number, a: number, b: number): Vec3 {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const [l3, m3, s3] = [l_ ** 3, m_ ** 3, s_ ** 3];
  return [
    +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
}

function linearSRGBtoOklab([r, g, b]: Vec3): Vec3 {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const [l_, m_, s_] = [Math.cbrt(l), Math.cbrt(m), Math.cbrt(s)];
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

function oklch(l: number, c: number, hDeg: number): Vec3 {
  const h = (hDeg * Math.PI) / 180;
  return oklabToLinearSRGB(l, c * Math.cos(h), c * Math.sin(h));
}

function srgbToLinear(c: number): number {
  const normalized = c / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function hex(value: string): Vec3 {
  const r = Number.parseInt(value.slice(1, 3), 16);
  const g = Number.parseInt(value.slice(3, 5), 16);
  const b = Number.parseInt(value.slice(5, 7), 16);
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}

/** Mirrors CSS `color-mix(in oklab, a <weightA>%, b)`. */
function mixOklab(a: Vec3, b: Vec3, weightA: number): Vec3 {
  const [la, aa, ba] = linearSRGBtoOklab(a);
  const [lb, ab, bb] = linearSRGBtoOklab(b);
  const t = 1 - weightA;
  return oklabToLinearSRGB(la + (lb - la) * t, aa + (ab - aa) * t, ba + (bb - ba) * t);
}

function relativeLuminance([r, g, b]: Vec3): number {
  const clamp = (c: number) => Math.min(1, Math.max(0, c));
  return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(b);
}

function contrastRatio(a: Vec3, b: Vec3): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// packages/web/src/index.css's tokens, resolved to the values behind each var().
const white: Vec3 = [1, 1, 1];
const gray100 = oklch(0.967, 0.003, 264.542);
// biome-ignore lint/suspicious/noApproximativeNumericConstant: Tailwind's gray-400 lightness, not Math.SQRT1_2
const gray400 = oklch(0.707, 0.022, 261.325);
const gray500 = oklch(0.551, 0.027, 264.364);
const gray800 = oklch(0.278, 0.033, 256.848);
const gray900 = oklch(0.21, 0.034, 264.665);

const inkLight = gray900;
const mutedLight = mixOklab(gray500, inkLight, 0.9);
const accentLight = hex("#c1272d");
const accentHoverLight = mixOklab(accentLight, [0, 0, 0], 0.85);
const accentActiveLight = mixOklab(accentLight, [0, 0, 0], 0.7);

const inkDark = gray100;
const mutedDark = gray400;
const accentDark = mixOklab(accentLight, white, 0.9);

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

const cases: { name: string; fg: Vec3; bg: Vec3; minimum: number }[] = [
  { name: "ink on canvas, light", fg: inkLight, bg: gray100, minimum: AA_TEXT },
  { name: "ink on surface, light", fg: inkLight, bg: white, minimum: AA_TEXT },
  { name: "muted on canvas, light", fg: mutedLight, bg: gray100, minimum: AA_TEXT },
  { name: "muted on surface, light", fg: mutedLight, bg: white, minimum: AA_TEXT },
  { name: "white text on accent, light", fg: white, bg: accentLight, minimum: AA_TEXT },
  { name: "focus ring on canvas, light", fg: accentLight, bg: gray100, minimum: AA_NON_TEXT },
  {
    name: "accent-hover focus ring on canvas, light",
    fg: accentHoverLight,
    bg: gray100,
    minimum: AA_NON_TEXT,
  },
  {
    name: "accent-active focus ring on canvas, light",
    fg: accentActiveLight,
    bg: gray100,
    minimum: AA_NON_TEXT,
  },
  { name: "ink on canvas, dark", fg: inkDark, bg: gray900, minimum: AA_TEXT },
  { name: "ink on surface, dark", fg: inkDark, bg: gray800, minimum: AA_TEXT },
  { name: "muted on canvas, dark", fg: mutedDark, bg: gray900, minimum: AA_TEXT },
  { name: "muted on surface, dark", fg: mutedDark, bg: gray800, minimum: AA_TEXT },
  { name: "white text on accent, dark", fg: white, bg: accentDark, minimum: AA_TEXT },
  { name: "focus ring on canvas, dark", fg: accentDark, bg: gray900, minimum: AA_NON_TEXT },
  { name: "focus ring on surface, dark", fg: accentDark, bg: gray800, minimum: AA_NON_TEXT },
];

describe("theme token contrast", () => {
  it.each(cases)("$name clears its WCAG minimum", ({ fg, bg, minimum }) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(minimum);
  });
});
