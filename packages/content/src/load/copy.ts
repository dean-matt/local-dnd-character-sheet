/**
 * Resolves 5etools `_copy` inheritance, so loaders only ever see complete records.
 *
 * An entry carrying a `_copy` block is a diff against another entry. The block
 * names the parent by the identity fields it lists, `_mod` describes edits to
 * apply after the clone, and `_preserve` names the parent metadata that survives
 * it. No entity type is hardcoded: a property is resolved because it holds
 * entries, and identity is whatever the block spells out.
 *
 * A parent may sit in another file — 1,060 blocks copy that way, all of them
 * under `data/bestiary/` — so resolution spans every source a loader declared
 * rather than one file at a time. The pool is that declared set and nothing
 * wider, which is what keeps a mapping file such as `class/foundry.json` from
 * shadowing a real entry with a second match.
 *
 * Anything unresolvable throws, rather than reaching a loader half-inherited.
 * `_copy._templates` is the one exception: it names a `monsterTemplate` rather
 * than a parent, so `identityKeys` drops it with every other `_` key and the
 * copy resolves without the traits that template would have added.
 */
import { type Entry, isRecord } from "./json.ts";
import { applyMod } from "./mod.ts";

/** Parent metadata that does not survive a copy unless `_copy._preserve` names it. */
const NOT_INHERITED = [
  "page",
  "srd",
  "srd52",
  "basicRules",
  "basicRules2024",
  "otherSources",
  "referenceSources",
  "reprintedAs",
  "isReprinted",
  "hasFluff",
  "hasFluffImages",
];

/** The fields a `_copy` block names *are* the identity key — everything but `_mod` and `_preserve`. */
function identityKeys(copy: Entry): string[] {
  return Object.keys(copy).filter((key) => !key.startsWith("_"));
}

function describe(entry: Entry, keys: string[]): string {
  const extra = keys
    .filter((key) => key !== "name" && key !== "source")
    .map((key) => `${key}=${String(entry[key])}`)
    .join(", ");
  return `"${String(entry.name)}" (${String(entry.source)})${extra ? ` [${extra}]` : ""}`;
}

/**
 * Case folded, because upstream's own lookup lowercases a key before matching and
 * the data leans on that: `Ougalop` (OotA) copies `Kuo-Toa` (MM), which upstream
 * spells `Kuo-toa`. Comparing verbatim makes that block name no parent.
 */
const fold = (value: unknown): unknown => (typeof value === "string" ? value.toLowerCase() : value);

/**
 * Every entry the block's keys match, not the first. A block matching two is a
 * block that does not name a parent, and taking the first would clone whichever
 * upstream happened to list earlier — the wrong entry, silently, and only for
 * the identities that collide.
 */
function findParents(entries: Entry[], copy: Entry, keys: string[]): Entry[] {
  return entries.filter((candidate) =>
    keys.every((key) => fold(candidate[key]) === fold(copy[key])),
  );
}

/** The one entry the block names, refusing a block that names none or several. */
function onlyParent(
  entries: Entry[],
  entry: Entry,
  copy: Entry,
  keys: string[],
  context: string,
): Entry {
  const parents = findParents(entries, copy, keys);
  const only = parents[0];
  if (parents.length === 1 && only) return only;
  const trouble =
    parents.length === 0
      ? "which no source the loader declared holds"
      : `which ${parents.length} entries match — the block needs a key that tells them apart`;
  throw new Error(
    `${context}: ${describe(entry, keys)} copies ${describe(copy, keys)}, ${trouble}`,
  );
}

function merge(child: Entry, parent: Entry, copy: Entry, context: string): Entry {
  const preserve = isRecord(copy._preserve) ? copy._preserve : {};
  const inherited = structuredClone(parent);
  for (const key of NOT_INHERITED) if (!preserve[key]) delete inherited[key];
  // A version belongs to the entry that declared it. Each one names itself
  // outright, the parent's source included, so an inherited block emits the
  // parent's variant a second time under the child: 105 bestiary copies carry
  // one, and `Mage (Familiar)` (MM) would arrive from thirty-five of them.
  delete inherited._versions;

  const { _copy: _dropped, ...own } = child;
  const merged: Entry = { ...inherited, ...own };

  if (isRecord(copy._mod)) applyMod(merged, copy._mod, context);
  // A null in the child is upstream's idiom for erasing an inherited value —
  // `"lineage": null` on a race that copies one that has a lineage.
  for (const [key, value] of Object.entries(merged)) if (value === null) delete merged[key];
  return merged;
}

/**
 * The entry's `_copy` block, validated, or undefined when it has none.
 *
 * Gating on `isRecord` would read a malformed block as "no copy", and the entry
 * would reach a loader with none of the parent's fields and nothing raised.
 */
function copyBlock(entry: Entry, context: string): Entry | undefined {
  if (!("_copy" in entry)) return undefined;
  const named = describe(entry, ["name", "source"]);
  if (!isRecord(entry._copy)) {
    throw new Error(`${context}: ${named} has a _copy that is not an object`);
  }
  for (const key of ["_mod", "_preserve"]) {
    const value = entry._copy[key];
    if (value !== undefined && !isRecord(value)) {
      throw new Error(`${context}: ${named} has a ${key} that is not an object`);
    }
  }
  return entry._copy;
}

/** Where an entry was read, so a broken parent reports its own file rather than its child's. */
type Located = { property: string; context: string };

/**
 * Every record element of every array property, pooled by property name.
 *
 * Pooling by property rather than by file is what lets a parent sit elsewhere,
 * and pooling only the sources a loader declared is what stops that from finding
 * two: `class/foundry.json` carries a second `Battle Master` (PHB), and no loader
 * declares it.
 */
function locate(sources: Map<string, unknown>): {
  candidates: Map<string, Entry[]>;
  located: Map<Entry, Located>;
} {
  const candidates = new Map<string, Entry[]>();
  const located = new Map<Entry, Located>();
  for (const [path, source] of sources) {
    if (!isRecord(source)) continue;
    for (const [property, entries] of Object.entries(source)) {
      if (!Array.isArray(entries)) continue;
      const where: Located = { property, context: `${path} ${property}` };
      const pool = candidates.get(property) ?? [];
      for (const entry of entries.filter(isRecord)) {
        pool.push(entry);
        located.set(entry, where);
      }
      candidates.set(property, pool);
    }
  }
  return { candidates, located };
}

/**
 * Returns every source with its `_copy` blocks resolved, parents in other sources
 * included. Takes the whole set rather than one file because a parent may be in
 * any of them, and resolves every array property rather than the ones
 * `_meta.internalCopies` names: 31 files carry a same-file `_copy` without
 * declaring one, so that list has never been the thing worth trusting.
 */
export function resolveCopies(sources: Map<string, unknown>): Map<string, unknown> {
  const { candidates, located } = locate(sources);
  const resolved = new Map<Entry, Entry>();
  const visiting = new Set<Entry>();

  const resolve = (entry: Entry): Entry => {
    const cached = resolved.get(entry);
    if (cached) return cached;

    const here = located.get(entry);
    const context = here?.context ?? "an entry no source holds";
    const copy = copyBlock(entry, context);
    if (!copy) {
      resolved.set(entry, entry);
      return entry;
    }

    const keys = identityKeys(copy);
    // `filter` over no keys matches everything, so this would clone entry zero.
    if (keys.length === 0) {
      throw new Error(
        `${context}: ${describe(entry, ["name", "source"])} has a _copy that names no parent`,
      );
    }
    const parent = onlyParent(
      candidates.get(here?.property ?? "") ?? [],
      entry,
      copy,
      keys,
      context,
    );
    visiting.add(entry);
    if (visiting.has(parent)) {
      throw new Error(
        `${context}: ${describe(entry, keys)} copies ${describe(parent, keys)}, which is already being resolved — _copy cycle`,
      );
    }
    const merged = merge(entry, resolve(parent), copy, context);
    visiting.delete(entry);
    resolved.set(entry, merged);
    return merged;
  };

  const result = new Map<string, unknown>();
  for (const [path, source] of sources) {
    if (!isRecord(source)) {
      result.set(path, source);
      continue;
    }
    const next: Entry = { ...source };
    for (const [property, entries] of Object.entries(source)) {
      if (!Array.isArray(entries)) continue;
      next[property] = entries.map((entry) => (isRecord(entry) ? resolve(entry) : entry));
    }
    result.set(path, next);
  }
  return result;
}
