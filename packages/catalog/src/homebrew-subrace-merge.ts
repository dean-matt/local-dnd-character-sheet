/**
 * A homebrew subrace's `json` over its race's, the merge `content`'s ETL runs on a catalog
 * subrace, which it cannot import. Where the two cannot combine, the ETL refuses the row and
 * this lets the subrace's list replace the race's, so a sheet still opens. A homebrew
 * subrace's entry carries no `overwrite` flags.
 */
import { isRecord } from "./entry-text.ts";

type Entry = Record<string, unknown>;

/** The subrace's identity, which the merged row leaves as the race's. */
const OWN = new Set(["name", "source"]);

const traitName = (entry: unknown): string =>
  isRecord(entry) && typeof entry.name === "string" ? entry.name.trim().toLowerCase() : "";

function standsInFor(trait: unknown): string | undefined {
  const replaces = isRecord(trait) && isRecord(trait.data) ? trait.data.overwrite : undefined;
  return typeof replaces === "string" ? replaces.trim().toLowerCase() : undefined;
}

/** The race's traits with the subrace's appended, each naming one in `data.overwrite` in its place. */
function mergeEntries(mine: unknown, theirs: unknown[]): unknown[] {
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

/** Slot by slot where both offer the same number of ways to take the increases. */
function mergeAbility(mine: unknown, theirs: unknown[]): unknown[] {
  if (!Array.isArray(mine) || mine.length !== theirs.length) return theirs;
  return mine.map((slot, index) => ({
    ...(isRecord(slot) ? slot : {}),
    ...(isRecord(theirs[index]) ? theirs[index] : {}),
  }));
}

/** A union of two single sets; a list of more than one is a choice between sets, which does not combine. */
function mergeProficiencies(mine: unknown, theirs: unknown[]): unknown[] {
  if (!Array.isArray(mine) || mine.length !== 1 || theirs.length !== 1) return theirs;
  return [{ ...(isRecord(mine[0]) ? mine[0] : {}), ...(isRecord(theirs[0]) ? theirs[0] : {}) }];
}

const MERGE: Record<string, (mine: unknown, theirs: unknown[]) => unknown[]> = {
  entries: mergeEntries,
  ability: mergeAbility,
  skillProficiencies: mergeProficiencies,
  languageProficiencies: mergeProficiencies,
};

export function mergeHomebrewSubrace(race: Entry, subrace: Entry): Entry {
  const merged: Entry = structuredClone(race);
  const traits = Array.isArray(subrace.entries) ? subrace.entries : [];
  // A subrace whose Languages trait stands in for the race's replaces its languages too.
  const restatesLanguages = traits.some((trait) => standsInFor(trait) === "languages");
  for (const [field, value] of Object.entries(subrace)) {
    if (OWN.has(field)) continue;
    const rule = MERGE[field];
    const replaced = field === "languageProficiencies" && restatesLanguages;
    merged[field] = rule && Array.isArray(value) && !replaced ? rule(merged[field], value) : value;
  }
  for (const [field, value] of Object.entries(merged)) {
    if (value === null) delete merged[field];
  }
  return merged;
}
