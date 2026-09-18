/**
 * Merges a `fluff-*.json` file's lore into the `json` of the entry it describes.
 *
 * Fluff is keyed to its entry by identity fields folded to lowercase, the same
 * folding `copy.ts` applies to a `_copy` block: upstream's own matching folds
 * too, and five recipes prove it — the recipe is `Eye Of The Beholder`, its
 * fluff `Eye of the Beholder`.
 *
 * An entry's own `hasFluff` or `hasFluffImages` is upstream's promise that a
 * fluff entry exists for it, and that promise is what a build checks — not
 * whether every fluff entry found a row. Bestiary lore is written once for a
 * species and `_copy`'d into every member, so the species entry itself —
 * `Aartuks` (BAM) — names no monster and carries neither flag; a handful of
 * class files carry a placeholder `subclassFluff` naming the class itself
 * rather than a subclass, for the same reason. Checking every promise instead
 * of every fluff entry reaches the real lore without tripping on either.
 */
import { type Entry, isRecord, text } from "./json.ts";

const fold = (value: string): string => value.toLowerCase();

/** The key a fluff entry and the row it describes agree on. */
export function fluffKey(...parts: string[]): string {
  return parts.map(fold).join("|");
}

/** The key most fluff kinds agree on: their own `name` and `source`. */
export function byNameSource(entry: Entry, context: string): string {
  return fluffKey(text(entry, "name", context), text(entry, "source", context));
}

/** Whether a vendor-relative path is a `fluff-*.json` file rather than an entry it describes. */
export function isFluffPath(path: string): boolean {
  return path.slice(path.lastIndexOf("/") + 1).startsWith("fluff-");
}

/**
 * A fluff file's array, or none where the file carries no entries of that
 * kind — `fluff-class-mystic.json` has no `subclassFluff` at all, the class
 * having no subclasses, and refusing that absence would refuse every class
 * with no fluff of one kind rather than the other.
 */
function fluffEntries(parsed: unknown, arrayKey: string): Entry[] {
  if (!isRecord(parsed)) return [];
  const list = parsed[arrayKey];
  return Array.isArray(list) ? list.filter(isRecord) : [];
}

/**
 * Every fluff entry the given files carry under `arrayKey`, indexed by the key
 * `keyOf` derives from each one. Several files pool into one lookup because a
 * kind's fluff is one file per source — every `fluff-bestiary-*.json` for
 * `monsterFluff`, every `fluff-spells-*.json` for `spellFluff` — and a monster
 * or a spell does not know which one names it.
 */
export function collectFluff(
  files: [string, unknown][],
  arrayKey: string,
  keyOf: (entry: Entry, context: string) => string,
): (key: string) => Entry | undefined {
  const byKey = new Map<string, Entry>();
  for (const [path, parsed] of files) {
    fluffEntries(parsed, arrayKey).forEach((entry, index) => {
      byKey.set(keyOf(entry, `${path} ${arrayKey}[${index}]`), entry);
    });
  }
  return (key) => byKey.get(key);
}

/** Fields a fluff entry carries only to state which row it describes. */
const FLUFF_IDENTITY = new Set(["name", "source", "className", "classSource", "shortName"]);

/**
 * The entry with the matching fluff folded in under `fluff`, refusing a row
 * that upstream promised one for and no pool held. An entry with no promise
 * and no match is returned unchanged — most of the catalog carries no lore.
 */
export function withFluff(entry: Entry, found: Entry | undefined, context: string): Entry {
  if (found === undefined) {
    const promise = ["hasFluff", "hasFluffImages"].find((flag) => entry[flag] === true);
    if (promise !== undefined) {
      throw new Error(`${context}: ${promise} promises a fluff entry no file carries`);
    }
    return entry;
  }
  const lore = Object.fromEntries(
    Object.entries(found).filter(([field]) => !FLUFF_IDENTITY.has(field)),
  );
  return Object.keys(lore).length === 0 ? entry : { ...entry, fluff: lore };
}
