/**
 * Which of the two rulesets a source belongs to.
 *
 * Sparse few entries declare an `edition` — no spell does — so the source
 * decides, by when its book was published: everything from the 2024 Player's
 * Handbook onward is `one`.
 *
 * A date is inference where a declaration would be fact. It is used because the
 * alternative, a hand-kept list of abbreviations, is wrong the day upstream
 * ships a book and says so nowhere. This rule agrees with all 24 sources in the
 * corpus that do declare an edition, `PaF` seven weeks before the cutoff
 * included. A source no book or adventure names falls to `classic`.
 */
import { type Entry, isRecord } from "./json.ts";

export type Edition = "classic" | "one";

const ONE_PUBLISHED_FROM = "2024-09-17";

const CONTENTS = [
  ["data/books.json", "book"],
  ["data/adventures.json", "adventure"],
] as const;

/** The files `editions` reads. A loader writing an `edition` declares them too. */
export const EDITION_FILES = CONTENTS.map(([path]) => path);

function entriesIn(sources: Map<string, unknown>, path: string, key: string): Entry[] {
  const parsed = sources.get(path);
  const entries = isRecord(parsed) ? parsed[key] : undefined;
  if (!Array.isArray(entries)) throw new Error(`${path} carries no ${key} array`);
  return entries.filter(isRecord);
}

/** Resolves a source abbreviation to its edition. Dates are ISO, so they sort as text. */
export function editions(sources: Map<string, unknown>): (source: string) => Edition {
  const one = new Set<string>();
  for (const [path, key] of CONTENTS) {
    for (const entry of entriesIn(sources, path, key)) {
      const { source, published } = entry;
      if (typeof source !== "string" || typeof published !== "string") continue;
      if (published >= ONE_PUBLISHED_FROM) one.add(source);
    }
  }
  return (source) => (one.has(source) ? "one" : "classic");
}
