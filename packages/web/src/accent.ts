import {
  AA_NON_TEXT,
  AA_TEXT,
  black,
  canvasDark,
  canvasLight,
  contrastRatio,
  hex,
  mixOklab,
  subtleDark,
  subtleLight,
  surfaceDark,
  type Vec3,
  white,
} from "./lib/contrast.ts";

export const DEFAULT_ACCENT = "#c1272d";

/**
 * The mockup's five presets. Its orange, `#d9730d`, measures 3.00:1 on the light canvas,
 * so the preset scales it down to the lightest shade that clears every light pair.
 */
export const ACCENT_PRESETS = [
  { name: "Red", color: DEFAULT_ACCENT },
  { name: "Orange", color: "#9e5409" },
  { name: "Green", color: "#3f5d44" },
  { name: "Blue", color: "#3a4f7a" },
  { name: "Plum", color: "#7a3b53" },
] as const;

/**
 * A chosen accent and the share of white, in percent, that the dark theme mixes into it:
 * `ring` for `--color-accent`, `text` for `--color-accent-text`.
 */
export type Accent = { color: string; ring: number; text: number };

type Pair = { name: string; fg: Vec3; bg: Vec3; minimum: number };

const surfaces = (theme: string, ...grounds: [string, Vec3][]) =>
  grounds.map(([ground, bg]) => ({ ground: `${ground}, ${theme}`, bg }));

/** The light accent pairs, which `contrast.test.ts` also holds the default accent to. */
export function lightPairs(accent: Vec3): Pair[] {
  const grounds = surfaces(
    "light",
    ["canvas", canvasLight],
    ["surface", white],
    ["subtle", subtleLight],
  );
  return [
    ...grounds.map(({ ground, bg }) => ({
      name: `accent-text on ${ground}`,
      fg: accent,
      bg,
      minimum: AA_TEXT,
    })),
    {
      name: "accent on accent-tint, light",
      fg: accent,
      bg: mixOklab(accent, canvasLight, 0.1),
      minimum: AA_TEXT,
    },
    { name: "white text on accent, light", fg: white, bg: accent, minimum: AA_TEXT },
    {
      name: "accent-hover focus ring on canvas, light",
      fg: mixOklab(accent, black, 0.85),
      bg: canvasLight,
      minimum: AA_NON_TEXT,
    },
    {
      name: "accent-active focus ring on canvas, light",
      fg: mixOklab(accent, black, 0.7),
      bg: canvasLight,
      minimum: AA_NON_TEXT,
    },
  ];
}

/** Takes the dark `--color-accent`. */
export function darkRingPairs(ring: Vec3): Pair[] {
  return [
    { name: "focus ring on canvas, dark", fg: ring, bg: canvasDark, minimum: AA_NON_TEXT },
    { name: "focus ring on surface, dark", fg: ring, bg: surfaceDark, minimum: AA_NON_TEXT },
    // Checked as non-text: the dark accent on the dark surface already sits near 3:1.
    {
      name: "accent on accent-tint, dark",
      fg: ring,
      bg: mixOklab(ring, canvasDark, 0.1),
      minimum: AA_NON_TEXT,
    },
    { name: "white text on accent, dark", fg: white, bg: ring, minimum: AA_TEXT },
  ];
}

/** Takes the dark `--color-accent-text`. */
export function darkTextPairs(text: Vec3): Pair[] {
  const grounds = surfaces(
    "dark",
    ["canvas", canvasDark],
    ["surface", surfaceDark],
    ["subtle", subtleDark],
  );
  return grounds.map(({ ground, bg }) => ({
    name: `accent-text on ${ground}`,
    fg: text,
    bg,
    minimum: AA_TEXT,
  }));
}

const passes = (pairs: Pair[]) => pairs.every((p) => contrastRatio(p.fg, p.bg) >= p.minimum);

/** The least white, in whole percent, that makes `pairs` pass, or undefined where none does. */
function leastLift(color: Vec3, pairs: (shade: Vec3) => Pair[]): number | undefined {
  for (let lift = 0; lift <= 100; lift++) {
    if (passes(pairs(mixOklab(color, white, 1 - lift / 100)))) return lift;
  }
  return undefined;
}

/**
 * Holds a `#rrggbb` color to the accent pairs above. The light theme uses the color as chosen; the dark theme lightens it as little as clears
 * each pair there, which the default's fixed mixes in `index.css` cannot do for every hue.
 */
export function deriveAccent(color: string): { accent: Accent } | { refusal: string } {
  const base = hex(color);
  const failing = lightPairs(base).find((p) => contrastRatio(p.fg, p.bg) < p.minimum);
  if (failing) {
    const ratio = Math.floor(contrastRatio(failing.fg, failing.bg) * 100) / 100;
    return {
      refusal: `Too light for the light theme: it measures ${ratio.toFixed(2)}:1 where AA needs ${failing.minimum}:1.`,
    };
  }
  const ring = leastLift(base, darkRingPairs);
  if (ring === undefined) {
    return {
      refusal:
        "No shade of it in the dark theme keeps both white text on it and its focus ring readable.",
    };
  }
  const text = leastLift(base, darkTextPairs) ?? 100;
  return { accent: { color, ring, text } };
}

const STORAGE_KEY = "accent";
const COLOR = /^#[0-9a-f]{6}$/;
const isPercent = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 100;

function applyToDocument(accent: Accent | undefined): void {
  const style = document.documentElement.style;
  if (accent) {
    style.setProperty("--accent", accent.color);
    style.setProperty("--accent-ring-lift", `${accent.ring}%`);
    style.setProperty("--accent-text-lift", `${accent.text}%`);
  } else {
    for (const name of ["--accent", "--accent-ring-lift", "--accent-text-lift"]) {
      style.removeProperty(name);
    }
  }
}

export function getStoredAccent(): string {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return COLOR.test(stored?.color) && isPercent(stored.ring) && isPercent(stored.text)
      ? stored.color
      : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

/** Takes an accent `deriveAccent` cleared; the default clears the stored choice instead. */
export function setStoredAccent(accent: Accent): void {
  const chosen = accent.color === DEFAULT_ACCENT ? undefined : accent;
  applyToDocument(chosen);

  try {
    if (chosen) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chosen));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage can throw in private mode or with blocked site data. The document carries
    // the accent regardless, so it applies for this session without surviving a reload.
  }
}

/**
 * Re-derives the stored choice, so lifts stored before a dark token changed still clear
 * their pairs, and a choice the new tokens refuse falls back to the default.
 */
export function refreshStoredAccent(): void {
  const result = deriveAccent(getStoredAccent());
  setStoredAccent("accent" in result ? result.accent : { color: DEFAULT_ACCENT, ring: 0, text: 0 });
}
