/**
 * Resolves 5etools `_copy` inheritance, so loaders only ever see complete records.
 *
 * An entry carrying a `_copy` block is a diff against another entry in the same
 * file. The block names the parent by the identity fields it lists, `_mod`
 * describes edits to apply after the clone, and `_preserve` names the parent
 * metadata that survives it. `_meta.internalCopies` names the properties that
 * need any of this, which is why no entity type is hardcoded here.
 *
 * Anything unresolvable throws, rather than reaching a loader half-inherited.
 * That includes a parent in another file: bestiary entries copy that way,
 * character-relevant ones never do.
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
 * Every entry the block's keys match, not the first. A block matching two is a
 * block that does not name a parent, and taking the first would clone whichever
 * upstream happened to list earlier — the wrong entry, silently, and only for
 * the identities that collide.
 */
function findParents(entries: Entry[], copy: Entry, keys: string[]): Entry[] {
  // A scan touches every entry, malformed ones included. Reporting those is
  // `resolve`'s job, and it names the file and the property; reading a key off
  // one here throws a bare TypeError from underneath that.
  return entries.filter(
    (candidate) => isRecord(candidate) && keys.every((key) => candidate[key] === copy[key]),
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
      ? "which no entry in the file matches"
      : `which ${parents.length} entries match — the block needs a key that tells them apart`;
  throw new Error(
    `${context}: ${describe(entry, keys)} copies ${describe(copy, keys)}, ${trouble}`,
  );
}

function merge(child: Entry, parent: Entry, copy: Entry, context: string): Entry {
  const preserve = isRecord(copy._preserve) ? copy._preserve : {};
  const inherited = structuredClone(parent);
  for (const key of NOT_INHERITED) if (!preserve[key]) delete inherited[key];

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
 * Gating on `isRecord` would read a malformed block as "no copy" — as would
 * `assertResolved`, the net under this — so the entry would reach a loader with
 * none of the parent's fields.
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

function resolveEntries(entries: Entry[], context: string): Entry[] {
  const resolved = new Map<Entry, Entry>();
  const visiting = new Set<Entry>();

  const resolve = (entry: Entry): Entry => {
    if (!isRecord(entry)) {
      const found = entry === null ? "null" : typeof entry;
      throw new Error(`${context}: expected entries to be objects, found ${found}`);
    }
    const cached = resolved.get(entry);
    if (cached) return cached;

    const copy = copyBlock(entry, context);
    if (!copy) {
      resolved.set(entry, entry);
      return entry;
    }

    const keys = identityKeys(copy);
    // `find` over no keys matches everything, so this would clone entry zero.
    if (keys.length === 0) {
      throw new Error(
        `${context}: ${describe(entry, ["name", "source"])} has a _copy that names no parent`,
      );
    }
    const parent = onlyParent(entries, entry, copy, keys, context);
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

  return entries.map(resolve);
}

/**
 * Throws if a top-level entry still carries a `_copy`, meaning the file needed
 * resolving and `_meta.internalCopies` did not say so — true of many bestiary
 * files, which would otherwise reach a loader as diffs, in silence.
 *
 * Direct elements only. Catching a `_copy` deeper in a `data[].entries[]` tree
 * costs a full walk of `adventure/` and `book/` on every read, for a shape no
 * character-relevant file uses.
 */
function assertResolved(source: Entry, label: string): void {
  for (const [property, entries] of Object.entries(source)) {
    if (!Array.isArray(entries)) continue;
    const unresolved = entries.filter((entry) => isRecord(entry) && "_copy" in entry);
    const [first] = unresolved;
    if (!isRecord(first)) continue;
    throw new Error(
      `${label} ${property}: ${describe(first, ["name", "source"])} carries a _copy that no ` +
        `_meta.internalCopies claims (${unresolved.length} in this property)`,
    );
  }
}

/** Returns `source` with every `_copy` under `_meta.internalCopies` resolved. */
export function resolveCopies(source: unknown, label: string): unknown {
  if (!isRecord(source)) return source;
  const meta = isRecord(source._meta) ? source._meta : undefined;
  const types = Array.isArray(meta?.internalCopies) ? meta.internalCopies : [];
  if (types.length === 0) {
    assertResolved(source, label);
    return source;
  }

  const result: Entry = { ...source };
  for (const type of types) {
    const entries = typeof type === "string" ? result[type] : undefined;
    if (!Array.isArray(entries)) continue;
    result[type] = resolveEntries(entries as Entry[], `${label} ${type}`);
  }
  // Also catches a `_copy` under a property `internalCopies` does not name.
  assertResolved(result, label);
  return result;
}
