import type { HomebrewEntry } from "./homebrewDraft.ts";

/**
 * Where an entry was printed. A copy is homebrew, so it keeps none of it; `source` the
 * server stamps.
 */
const PROVENANCE = [
  "source",
  "page",
  "srd",
  "srd52",
  "basicRules",
  "basicRules2024",
  "otherSources",
  "additionalSources",
  "referenceSources",
  "reprintedAs",
  "hasFluff",
  "hasFluffImages",
];

/** `entry`'s fields as a new homebrew entry starts from them, named `name`. */
export function copiedEntry(entry: Record<string, unknown>, name: string): HomebrewEntry {
  const copy = Object.fromEntries(
    Object.entries(entry).filter(([key]) => !PROVENANCE.includes(key)),
  );
  return { ...copy, name };
}

/**
 * `name` marked as a copy, since the original holds it, and numbered past every name `taken`
 * holds, compared ignoring case.
 */
export function copyName(name: string, taken: readonly string[]): string {
  const used = new Set(taken.map((each) => each.toLowerCase()));
  for (let count = 1; ; count++) {
    const next = count === 1 ? `${name} (copy)` : `${name} (copy ${count})`;
    if (!used.has(next.toLowerCase())) return next;
  }
}
