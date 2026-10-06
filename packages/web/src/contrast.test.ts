import { describe, expect, it } from "vitest";
import {
  AA_NON_TEXT,
  AA_TEXT,
  black,
  canvasDark,
  canvasLight,
  contrastRatio,
  hex,
  mixOklab,
  oklch,
  subtleDark,
  subtleLight,
  surfaceDark,
  type Vec3,
  white,
} from "./lib/contrast.ts";

/**
 * Contrast holding in both themes needs to stay a checked property rather than a one-time
 * claim, so a future repalette that regresses it fails here instead of shipping unnoticed.
 */

// packages/web/src/index.css's tokens, resolved to the values behind each var().
const gray100 = oklch(0.967, 0.003, 264.542);
const gray300 = oklch(0.872, 0.01, 258.338);
// biome-ignore lint/suspicious/noApproximativeNumericConstant: Tailwind's gray-400 lightness, not Math.SQRT1_2
const gray400 = oklch(0.707, 0.022, 261.325);
const gray700 = oklch(0.373, 0.034, 259.733);
const gray800 = surfaceDark;
const gray900 = canvasDark;

const inkLight = hex("#1f2430");
const secondaryLight = hex("#4b5260");
const mutedLight = mixOklab(hex("#6b7280"), inkLight, 0.92);
const placeholderLight = mutedLight;
const borderLight = hex("#dde1e6");
const accentLight = hex("#c1272d");
const accentHoverLight = mixOklab(accentLight, black, 0.85);
const accentActiveLight = mixOklab(accentLight, black, 0.7);
const accentTintLight = mixOklab(accentLight, canvasLight, 0.1);
const positiveLight = hex("#2f6b4f");

const inkDark = gray100;
const secondaryDark = gray300;
const mutedDark = gray400;
const placeholderDark = mutedDark;
const accentDark = mixOklab(accentLight, white, 0.9);
const accentTextDark = mixOklab(accentLight, white, 0.6);
// Checked as non-text: the dark accent on the dark surface already sits near 3:1.
const accentTintDark = mixOklab(accentDark, gray900, 0.1);
const positiveDark = mixOklab(positiveLight, white, 0.5);
const moneyLight = hex("#7a5b00");
const moneyTintLight = hex("#fbf3dc");
const moneyDark = hex("#e5cf8f");
const moneyTintDark = mixOklab(moneyLight, gray800, 0.3);

const TYPE_FILLS = {
  spell: "#3a4f7a",
  item: "#8a6a2e",
  feat: "#6b4f7a",
  race: "#5b5f66",
  feature: "#4f6b6b",
  monster: "#7a3b2e",
};

const cases: { name: string; fg: Vec3; bg: Vec3; minimum: number }[] = [
  { name: "ink on canvas, light", fg: inkLight, bg: canvasLight, minimum: AA_TEXT },
  { name: "ink on surface, light", fg: inkLight, bg: white, minimum: AA_TEXT },
  { name: "secondary on surface, light", fg: secondaryLight, bg: white, minimum: AA_TEXT },
  { name: "secondary on subtle, light", fg: secondaryLight, bg: subtleLight, minimum: AA_TEXT },
  { name: "secondary on canvas, light", fg: secondaryLight, bg: canvasLight, minimum: AA_TEXT },
  { name: "muted on canvas, light", fg: mutedLight, bg: canvasLight, minimum: AA_TEXT },
  { name: "muted on surface, light", fg: mutedLight, bg: white, minimum: AA_TEXT },
  { name: "ink on subtle, light", fg: inkLight, bg: subtleLight, minimum: AA_TEXT },
  { name: "muted on subtle, light", fg: mutedLight, bg: subtleLight, minimum: AA_TEXT },
  { name: "placeholder on canvas, light", fg: placeholderLight, bg: canvasLight, minimum: AA_TEXT },
  { name: "placeholder on surface, light", fg: placeholderLight, bg: white, minimum: AA_TEXT },
  { name: "placeholder on subtle, light", fg: placeholderLight, bg: subtleLight, minimum: AA_TEXT },
  { name: "accent-text on canvas, light", fg: accentLight, bg: canvasLight, minimum: AA_TEXT },
  { name: "accent-text on surface, light", fg: accentLight, bg: white, minimum: AA_TEXT },
  { name: "accent-text on subtle, light", fg: accentLight, bg: subtleLight, minimum: AA_TEXT },
  { name: "accent on accent-tint, light", fg: accentLight, bg: accentTintLight, minimum: AA_TEXT },
  { name: "white text on accent, light", fg: white, bg: accentLight, minimum: AA_TEXT },
  { name: "focus ring on canvas, light", fg: accentLight, bg: canvasLight, minimum: AA_NON_TEXT },
  {
    name: "accent-hover focus ring on canvas, light",
    fg: accentHoverLight,
    bg: canvasLight,
    minimum: AA_NON_TEXT,
  },
  {
    name: "accent-active focus ring on canvas, light",
    fg: accentActiveLight,
    bg: canvasLight,
    minimum: AA_NON_TEXT,
  },
  { name: "positive on surface, light", fg: positiveLight, bg: white, minimum: AA_TEXT },
  { name: "money on money-tint, light", fg: moneyLight, bg: moneyTintLight, minimum: AA_TEXT },
  {
    name: "spinner arc on its track, light",
    fg: mutedLight,
    bg: borderLight,
    minimum: AA_NON_TEXT,
  },
  { name: "ink on canvas, dark", fg: inkDark, bg: gray900, minimum: AA_TEXT },
  { name: "ink on surface, dark", fg: inkDark, bg: gray800, minimum: AA_TEXT },
  { name: "secondary on surface, dark", fg: secondaryDark, bg: gray800, minimum: AA_TEXT },
  { name: "secondary on subtle, dark", fg: secondaryDark, bg: subtleDark, minimum: AA_TEXT },
  { name: "secondary on canvas, dark", fg: secondaryDark, bg: gray900, minimum: AA_TEXT },
  { name: "muted on canvas, dark", fg: mutedDark, bg: gray900, minimum: AA_TEXT },
  { name: "muted on surface, dark", fg: mutedDark, bg: gray800, minimum: AA_TEXT },
  { name: "ink on subtle, dark", fg: inkDark, bg: subtleDark, minimum: AA_TEXT },
  { name: "muted on subtle, dark", fg: mutedDark, bg: subtleDark, minimum: AA_TEXT },
  { name: "placeholder on canvas, dark", fg: placeholderDark, bg: gray900, minimum: AA_TEXT },
  { name: "placeholder on surface, dark", fg: placeholderDark, bg: gray800, minimum: AA_TEXT },
  { name: "placeholder on subtle, dark", fg: placeholderDark, bg: subtleDark, minimum: AA_TEXT },
  { name: "accent-text on canvas, dark", fg: accentTextDark, bg: gray900, minimum: AA_TEXT },
  { name: "accent-text on surface, dark", fg: accentTextDark, bg: gray800, minimum: AA_TEXT },
  { name: "accent-text on subtle, dark", fg: accentTextDark, bg: subtleDark, minimum: AA_TEXT },
  { name: "accent on accent-tint, dark", fg: accentDark, bg: accentTintDark, minimum: AA_NON_TEXT },
  { name: "white text on accent, dark", fg: white, bg: accentDark, minimum: AA_TEXT },
  { name: "focus ring on canvas, dark", fg: accentDark, bg: gray900, minimum: AA_NON_TEXT },
  { name: "focus ring on surface, dark", fg: accentDark, bg: gray800, minimum: AA_NON_TEXT },
  { name: "positive on surface, dark", fg: positiveDark, bg: gray800, minimum: AA_TEXT },
  { name: "money on money-tint, dark", fg: moneyDark, bg: moneyTintDark, minimum: AA_TEXT },
  { name: "spinner arc on its track, dark", fg: mutedDark, bg: gray700, minimum: AA_NON_TEXT },
  ...Object.entries(TYPE_FILLS).flatMap(([type, fill]) => [
    { name: `white on type-${type}, light`, fg: white, bg: hex(fill), minimum: AA_TEXT },
    {
      name: `white on type-${type}, dark`,
      fg: white,
      bg: mixOklab(hex(fill), gray900, 0.85),
      minimum: AA_TEXT,
    },
  ]),
];

describe("theme token contrast", () => {
  it.each(cases)("$name clears its WCAG minimum", ({ fg, bg, minimum }) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(minimum);
  });
});
