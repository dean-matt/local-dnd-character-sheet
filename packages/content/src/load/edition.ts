/**
 * Which of the two rulesets a source belongs to.
 *
 * Sparse few entries declare an `edition` — no spell does — so the source
 * decides, by when its book was published: everything from the 2024 Player's
 * Handbook onward is `one`.
 *
 * A date is inference where a declaration would be fact. It is used because the
 * alternative, a hand-kept list of abbreviations, is wrong the day upstream
 * ships a book and says so nowhere. This rule agrees with all 20 sources in the
 * corpus that do declare an edition — 7 `one`, 13 `classic` — `PaF` three weeks
 * short of the cutoff included.
 *
 * The ceiling: a source no book or adventure names falls to `classic` silently,
 * and the schema cannot catch a wrong-but-valid edition. Six are absent at the
 * pinned tag — `EET`, `EEPC`, `TftYP`, `RoTOS`, `HAT-LMI`, `MCV2DC` — all of
 * them classic, so nothing is wrong yet. The way out is entry-level precedence:
 * 60 backgrounds and 18 races declare an `edition` of their own, and a loader
 * over either should let that win over this.
 */
import { EDITIONS, type Edition } from "@dnd/rules";
import { type Entry, isRecord } from "./json.ts";

export { EDITIONS, type Edition };

const ONE_PUBLISHED_FROM = "2024-09-17";

const CONTENTS = [
  ["data/books.json", "book"],
  ["data/adventures.json", "adventure"],
] as const;

/** The files `editions` reads. A loader writing an `edition` declares them too. */
export const EDITION_FILES: string[] = CONTENTS.map(([path]) => path);

/** A loader's own sources, with the files it declared only for `editions` removed. */
export function ownFiles(sources: Map<string, unknown>): [string, unknown][] {
  return [...sources].filter(([path]) => !EDITION_FILES.includes(path));
}

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

/** An entry's own `edition` where it declares one, and its source's otherwise. */
export function editionOf(
  entry: Entry,
  source: string,
  fromSource: (source: string) => Edition,
): Edition {
  const declared = entry.edition;
  if (declared === undefined) return fromSource(source);
  if (declared !== "classic" && declared !== "one") {
    throw new Error(`edition ${JSON.stringify(declared)} is neither classic nor one`);
  }
  return declared;
}
