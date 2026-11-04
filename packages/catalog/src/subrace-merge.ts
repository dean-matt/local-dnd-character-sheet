/**
 * A subrace's fields over its race's: `content`'s ETL builds a catalog subrace row with it,
 * and a homebrew subrace is merged with it when read. Traits, increases, languages, skills
 * and trait tags combine; every other field the subrace states replaces the race's.
 */
import { isRecord } from "./entry-text.ts";

type Entry = Record<string, unknown>;

/**
 * Throws `where`'s refusal for the ETL, which builds from data that must hold; with no
 * `where`, a homebrew subrace's list replaces the race's instead, so a sheet still opens.
 */
function refuse(where: string | undefined, reason: string): void {
  if (where !== undefined) throw new Error(`${where}: ${reason}`);
}

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
  where: string | undefined,
): unknown {
  const base = overwritten || !Array.isArray(mine) ? theirs.map(() => ({})) : mine;
  if (base.length !== theirs.length) {
    refuse(
      where,
      `the race offers ${base.length} ability entries and the subrace ${theirs.length}`,
    );
    return theirs;
  }
  return base.map((slot, index) => ({
    ...(isRecord(slot) ? slot : {}),
    ...(isRecord(theirs[index]) ? theirs[index] : {}),
  }));
}

const traitName = (entry: unknown): string =>
  isRecord(entry) && typeof entry.name === "string" ? entry.name.trim().toLowerCase() : "";

function standsInFor(trait: unknown): string | undefined {
  const replaces = isRecord(trait) && isRecord(trait.data) ? trait.data.overwrite : undefined;
  return typeof replaces === "string" ? replaces.trim().toLowerCase() : undefined;
}

/**
 * The race's traits with the subrace's appended, except where one names a trait
 * to stand in for: `data.overwrite` holds that trait's name, so a subrace
 * revising Darkvision replaces it rather than leaving the sheet two of them.
 */
function mergeEntries(mine: unknown, theirs: unknown[]): unknown {
  const merged = Array.isArray(mine) ? [...mine] : [];
  for (const trait of theirs) {
    const replaces = standsInFor(trait);
    const at =
      replaces === undefined ? -1 : merged.findIndex((held) => traitName(held) === replaces);
    if (at === -1) merged.push(trait);
    else merged[at] = trait;
  }
  return merged;
}

/**
 * One proficiency map with the other's entries over it, a union: the Sea Elf
 * speaks Common, Elvish and Aquan.
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
  where: string | undefined,
): unknown {
  if (overwritten || !Array.isArray(mine)) return theirs;
  if (mine.length !== 1 || theirs.length !== 1) {
    refuse(where, "merging a choice of proficiencies is not handled");
    return theirs;
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
  (mine: unknown, theirs: unknown[], overwritten: boolean, where: string | undefined) => unknown
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
function overwriteOf(sub: Entry, where: string | undefined): Set<string> {
  const declared = sub.overwrite;
  const named = new Set<string>();
  if (declared === undefined) return named;
  if (!isRecord(declared)) {
    refuse(where, "overwrite is not an object");
    return named;
  }
  for (const [field, on] of Object.entries(declared)) {
    if (typeof on !== "boolean") refuse(where, `overwrite.${field} is not a flag`);
    else if (!OVERWRITABLE.has(field))
      refuse(where, `overwrite names ${field}, which the merge has no rule to replace`);
    else if (on) named.add(field);
  }
  return named;
}

/**
 * The trait each merged field is the machine-readable half of, so that the two
 * halves of one statement cannot disagree. A subrace whose Languages trait
 * stands in for the race's is replacing its languages, flag or no flag:
 * `Variant; Mark of Finding|ERLW` states that trait under both its parents and
 * flags the field under only the Human, and the Half-Orc's row would otherwise
 * grant an Orc the same row's prose says the character does not speak.
 *
 * Only languages are spelled out twice. A trait standing in for `Darkvision`
 * or `Size` names a field the subrace replaces outright anyway, and no trait
 * is the prose half of `traitTags`, filter metadata upstream renders
 * nowhere.
 */
const SPELLED_OUT_BY: Record<string, string> = { languageProficiencies: "languages" };

/**
 * `sub`'s fields over a copy of `race`. `where` names the row in the error thrown where two
 * lists cannot combine or `overwrite` is malformed; without it the subrace's list wins and a
 * malformed flag is ignored.
 */
export function mergeSubrace(race: Entry, sub: Entry, where?: string): Entry {
  const flagged = overwriteOf(sub, where);
  const traits = Array.isArray(sub.entries) ? sub.entries : [];
  const replaced = new Set(flagged);
  for (const [field, trait] of Object.entries(SPELLED_OUT_BY)) {
    if (traits.some((held) => standsInFor(held) === trait)) replaced.add(field);
  }
  const merged: Entry = structuredClone(race);
  const { overwrite: _applied, ...own } = sub;
  for (const [field, value] of Object.entries(own)) {
    const rule = MERGE[field];
    merged[field] =
      rule && Array.isArray(value) ? rule(merged[field], value, replaced.has(field), where) : value;
  }
  // Overwriting with nothing leaves nothing. The Draconblood and the Ravenite
  // flag traitTags and then carry none, which upstream's renderer reads as no
  // instruction at all and leaves them tagged an Uncommon Race like the
  // Dragonborn they descend from. Here the flag is the only statement either
  // one makes about the field, so it is the one acted on.
  //
  // The flag alone, never a stand-in trait: a trait says how to combine two
  // values, and the Ixalan vampire stands in for Languages while declaring no
  // languages of its own — deleting the race's there would leave it mute.
  for (const field of flagged) {
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

/** A homebrew subrace over its race's row, which keeps the race's name and source. */
export function mergeHomebrewSubrace(race: Entry, subrace: Entry): Entry {
  const { name: _name, source: _source, ...own } = subrace;
  return mergeSubrace(race, own);
}
