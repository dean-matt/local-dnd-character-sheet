/**
 * `data/races.json` into the Tier A `races` and `subraces` tables.
 *
 * A subrace row holds the race merged with the subrace, not the subrace alone.
 * Upstream renders the pair together, and three dragonborn subraces revise
 * `Breath Weapon` — a trait only the parent carries — so a delta leaves those
 * unresolvable and leaves `overwrite`, the subrace's own flag for "replace this
 * inherited field rather than add to it", with nothing to act on. The merge
 * runs in `prepare` rather than here because those three state the revision as
 * a `_versions` `_mod`, which is applied before a loader sees an entry.
 *
 * What a subrace inherits is the race's traits, never its identity or its
 * printing history: a nameless subrace would otherwise answer to its parent's
 * name, and every row would claim the parent's page and reprints as its own.
 */
import { EDITION_FILES, editionOf, editions } from "./edition.ts";
import type { Loader, Row } from "./index.ts";
import { type Entry, entriesOf, isRecord, text } from "./json.ts";

const RACES_FILE = "data/races.json";

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

/**
 * The race's ability increases with the subrace's over them, slot by slot: a
 * subrace states the ones it changes and leaves the rest to the race. A slot is
 * a spread or a choice between spreads, and both sides offer the same number of
 * them, so a disagreement is refused rather than padded to the longer.
 */
function mergeAbility(
  mine: unknown,
  theirs: unknown[],
  overwritten: boolean,
  where: string,
): unknown {
  const base = overwritten || !Array.isArray(mine) ? theirs.map(() => ({})) : mine;
  if (base.length !== theirs.length) {
    throw new Error(
      `${where}: the race offers ${base.length} ability entries and the subrace ${theirs.length}`,
    );
  }
  return base.map((slot, index) => ({
    ...(isRecord(slot) ? slot : {}),
    ...(isRecord(theirs[index]) ? theirs[index] : {}),
  }));
}

const traitName = (entry: unknown): string =>
  isRecord(entry) && typeof entry.name === "string" ? entry.name.trim().toLowerCase() : "";

/**
 * The race's traits with the subrace's appended, except where one names a trait
 * to stand in for: `data.overwrite` holds that trait's name, so a subrace
 * revising Darkvision replaces it rather than leaving the sheet two of them.
 */
function mergeEntries(mine: unknown, theirs: unknown[]): unknown {
  const merged = Array.isArray(mine) ? [...mine] : [];
  for (const trait of theirs) {
    const replaces = isRecord(trait) && isRecord(trait.data) ? trait.data.overwrite : undefined;
    const at =
      typeof replaces === "string"
        ? merged.findIndex((held) => traitName(held) === replaces.trim().toLowerCase())
        : -1;
    if (at === -1) merged.push(trait);
    else merged[at] = trait;
  }
  return merged;
}

/**
 * One proficiency map with the other's entries over it, which is a union: the
 * Sea Elf speaks Common, Elvish and Aquan.
 *
 * A proficiency list of more than one element is a choice between sets, not a
 * longer set, so appending the subrace's would read as "the race's languages or
 * the subrace's" — the Sea Elf choosing between Aquan and the Elvish it already
 * restates. Merging two actual choices needs a rule for which of the two the
 * character picks from, and no entry has ever asked for one.
 */
function mergeProficiencies(
  mine: unknown,
  theirs: unknown[],
  overwritten: boolean,
  where: string,
): unknown {
  if (overwritten || !Array.isArray(mine)) return theirs;
  if (mine.length !== 1 || theirs.length !== 1) {
    throw new Error(`${where}: merging a choice of proficiencies is not handled`);
  }
  return [{ ...(isRecord(mine[0]) ? mine[0] : {}), ...(isRecord(theirs[0]) ? theirs[0] : {}) }];
}

/** A flat list of tags, where the subrace's are more of the same kind. */
function concat(mine: unknown, theirs: unknown[], overwritten: boolean): unknown {
  return overwritten || !Array.isArray(mine) ? theirs : [...mine, ...theirs];
}

/** How a list the subrace also carries combines with the race's. */
const MERGE: Record<
  string,
  (mine: unknown, theirs: unknown[], overwritten: boolean, where: string) => unknown
> = {
  ability: mergeAbility,
  entries: (mine, theirs) => mergeEntries(mine, theirs),
  skillProficiencies: mergeProficiencies,
  languageProficiencies: mergeProficiencies,
  traitTags: concat,
};

/** The lists a subrace's `overwrite` may replace instead of adding to. */
const OVERWRITABLE = new Set([
  "ability",
  "languageProficiencies",
  "skillProficiencies",
  "traitTags",
]);

/**
 * The fields a subrace's `overwrite` names. A flag on any other field is
 * refused rather than ignored, because it reads as a decision the merge acted
 * on: every other field the subrace already replaces outright, and `entries`
 * names the trait it stands in for one at a time instead.
 */
function overwriteOf(sub: Entry, where: string): Set<string> {
  const declared = sub.overwrite;
  if (declared === undefined) return new Set();
  if (!isRecord(declared)) throw new Error(`${where}: overwrite is not an object`);
  const named = new Set<string>();
  for (const [field, on] of Object.entries(declared)) {
    if (typeof on !== "boolean") throw new Error(`${where}: overwrite.${field} is not a flag`);
    if (!OVERWRITABLE.has(field)) {
      throw new Error(`${where}: overwrite names ${field}, which the merge has no rule to replace`);
    }
    if (on) named.add(field);
  }
  return named;
}

function merge(race: Entry, sub: Entry, where: string): Entry {
  const overwritten = overwriteOf(sub, where);
  const merged: Entry = structuredClone(
    Object.fromEntries(Object.entries(race).filter(([field]) => !RACE_ONLY.has(field))),
  );
  const { overwrite: _applied, ...own } = sub;
  for (const [field, value] of Object.entries(own)) {
    const rule = MERGE[field];
    merged[field] =
      rule && Array.isArray(value)
        ? rule(merged[field], value, overwritten.has(field), where)
        : value;
  }
  // Overwriting with nothing leaves nothing. The Draconblood and the Ravenite
  // flag traitTags and then carry none, which upstream's renderer reads as no
  // instruction at all and leaves them tagged an Uncommon Race like the
  // Dragonborn they descend from. Here the flag is the only statement either
  // one makes about the field, so it is the one acted on.
  for (const field of overwritten) {
    if (!(field in own)) delete merged[field];
  }
  // A null is how a subrace un-sets an inherited trait — the Draconblood drops
  // the Dragonborn's choice of damage resistance — so it stores as an absent
  // field rather than as a field holding nothing.
  for (const [field, value] of Object.entries(merged)) {
    if (value === null) delete merged[field];
  }
  return merged;
}

/** Every subrace merged with the race it names, in place of the subrace alone. */
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
function subraceName(entry: Entry, where: string): string {
  return entry.name === undefined ? "" : text(entry, "name", where);
}

export const races: Loader = {
  name: "races",
  files: [RACES_FILE, ...EDITION_FILES],
  prepare: (parsed, path) => (path === RACES_FILE ? adopt(parsed, path) : parsed),
  rows: (sources) => {
    const fromSource = editions(sources);
    const parsed = sources.get(RACES_FILE);
    return {
      races: entriesOf(parsed, "race", RACES_FILE).map((entry, index): Row => {
        const context = `${RACES_FILE} race[${index}]`;
        const source = text(entry, "source", context);
        return {
          name: text(entry, "name", context),
          source,
          edition: editionOf(entry, source, fromSource),
          json: JSON.stringify(entry),
        };
      }),
      subraces: entriesOf(parsed, "subrace", RACES_FILE).map((entry, index): Row => {
        const context = `${RACES_FILE} subrace[${index}]`;
        const source = text(entry, "source", context);
        return {
          name: subraceName(entry, context),
          source,
          race_name: text(entry, "raceName", context),
          race_source: text(entry, "raceSource", context),
          edition: editionOf(entry, source, fromSource),
          json: JSON.stringify(entry),
        };
      }),
    };
  },
};
