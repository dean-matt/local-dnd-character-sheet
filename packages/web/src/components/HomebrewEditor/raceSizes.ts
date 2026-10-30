import type { Option } from "./homebrewOptions.ts";

/** Upstream's size codes, in the order a race lists them. */
export const RACE_SIZE_CODES = ["T", "S", "M", "L", "H", "G", "V"] as const;

const LABELS: Record<(typeof RACE_SIZE_CODES)[number], string> = {
  T: "Tiny",
  S: "Small",
  M: "Medium",
  L: "Large",
  H: "Huge",
  G: "Gargantuan",
  V: "Small or Medium (varies)",
};

export const RACE_SIZES: Option[] = RACE_SIZE_CODES.map((value) => ({
  value,
  label: LABELS[value],
}));
