/**
 * `data/races.json` into the Tier A `races` and `subraces` tables.
 *
 * A subrace row holds the race merged with the subrace, not the subrace alone.
 * Upstream renders the pair together, and three dragonborn subraces revise
 * `Breath Weapon` — a trait only the parent carries — so a delta leaves those
 * unresolvable and leaves `overwrite`, the subrace's own flag for "replace this
 * inherited field rather than add to it", with nothing to act on. The merge
 * runs in `prepare` rather than here because those three state the revision as
 * a `_versions` `_mod`, applied before a loader sees an entry.
 *
 * What a subrace inherits is the race's traits, never its identity or its
 * printing history: a nameless subrace would otherwise answer to its parent's
 * name, and every row would claim the parent's page and reprints as its own.
 */
import { mergeSubrace } from "@dnd/catalog";
import { EDITION_FILES, editionOf, editions } from "./edition.ts";
import { collectFluff, fluffKey, withFluff } from "./fluff.ts";
import type { Loader, Row } from "./index.ts";
import { type Entry, entriesOf, isRecord, text } from "./json.ts";

const RACES_FILE = "data/races.json";
const RACES_FLUFF_FILE = "data/fluff-races.json";

/** The race's own, which a subrace does not inherit. */
const RACE_ONLY = new Set([
  "name",
  "source",
  "page",
  "otherSources",
  "reprintedAs",
  "srd",
  "srd52",
  "basicRules",
  "basicRules2024",
  "hasFluff",
  "hasFluffImages",
  "_versions",
]);

/** The race without its identity and printing history, with the subrace over it. */
const merge = (race: Entry, sub: Entry, where: string): Entry =>
  mergeSubrace(
    Object.fromEntries(Object.entries(race).filter(([field]) => !RACE_ONLY.has(field))),
    sub,
    where,
  );

function adopt(parsed: unknown, path: string): unknown {
  if (!isRecord(parsed)) throw new Error(`${path} is not an object`);
  const byKey = new Map<string, Entry>();
  for (const [index, race] of entriesOf(parsed, "race", path).entries()) {
    const context = `${path} race[${index}]`;
    byKey.set(`${text(race, "name", context)}|${text(race, "source", context)}`, race);
  }
  return {
    ...parsed,
    subrace: entriesOf(parsed, "subrace", path).map((sub, index) => {
      const context = `${path} subrace[${index}]`;
      const key = `${text(sub, "raceName", context)}|${text(sub, "raceSource", context)}`;
      const race = byKey.get(key);
      if (race === undefined) throw new Error(`${context}: no race ${key} to merge with`);
      return merge(race, sub, context);
    }),
  };
}

/**
 * A subrace's own name — High, not Elf (High) — or the empty string for the
 * five `PHB` base variants that carry none. A STRICT primary key column cannot
 * be NULL, so the empty string is the only way to write "this one has no name",
 * the same reading `lookups.qualifier` gives it.
 */
export function subraceName(entry: Entry, where: string): string {
  return entry.name === undefined ? "" : text(entry, "name", where);
}

/**
 * The compound name upstream writes for a subrace, in its race fluff and in a
 * `{@race}` tag: the race's name with the subrace's appended in parens, and the
 * fluff's `Base` where it carries none. A race that is itself a named variant reopens
 * its own closing paren rather than nesting a second — `Elf (Kaladesh)` names
 * `Elf (Kaladesh; Bishatar and Tirahar)`.
 */
function subraceFullName(raceName: string, subraceName: string): string {
  const label = subraceName === "" ? "Base" : subraceName;
  return raceName.endsWith(")") ? `${raceName.slice(0, -1)}; ${label})` : `${raceName} (${label})`;
}

export const races: Loader = {
  name: "races",
  files: [RACES_FILE, RACES_FLUFF_FILE, ...EDITION_FILES],
  prepare: (parsed, path) => (path === RACES_FILE ? adopt(parsed, path) : parsed),
  rows: (sources) => {
    const fromSource = editions(sources);
    const parsed = sources.get(RACES_FILE);
    const fluff = collectFluff(
      [[RACES_FLUFF_FILE, sources.get(RACES_FLUFF_FILE)]],
      "raceFluff",
      (entry, context) => fluffKey(text(entry, "name", context), text(entry, "source", context)),
    );
    return {
      races: entriesOf(parsed, "race", RACES_FILE).map((entry, index): Row => {
        const context = `${RACES_FILE} race[${index}]`;
        const source = text(entry, "source", context);
        const merged = withFluff(
          entry,
          fluff(fluffKey(text(entry, "name", context), source)),
          context,
        );
        return {
          name: text(entry, "name", context),
          source,
          edition: editionOf(entry, source, fromSource),
          json: JSON.stringify(merged),
        };
      }),
      subraces: entriesOf(parsed, "subrace", RACES_FILE).map((entry, index): Row => {
        const context = `${RACES_FILE} subrace[${index}]`;
        const source = text(entry, "source", context);
        const raceName = text(entry, "raceName", context);
        const name = subraceName(entry, context);
        const fullName = subraceFullName(raceName, name);
        const merged = withFluff(entry, fluff(fluffKey(fullName, source)), context);
        return {
          name,
          full_name: fullName,
          source,
          race_name: raceName,
          race_source: text(entry, "raceSource", context),
          edition: editionOf(entry, source, fromSource),
          json: JSON.stringify(merged),
        };
      }),
    };
  },
};
