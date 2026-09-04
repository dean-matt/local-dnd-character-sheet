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

type Entry = Record<string, unknown>;

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

/**
 * Keys whose values `replaceTxt` descends into: every prose-bearing key in the
 * vendored entry trees.
 *
 * Not a blocklist, because some strings it must skip are references rather than
 * structure — `subclassFeature`, `reprintedAs` and `data.overwrite` hold
 * `Name|Source|...` pointers, and rewriting prose must not rewrite a link.
 */
const TEXT_KEYS = new Set([
  "entry",
  "entries",
  "name",
  "items",
  "rows",
  "caption",
  "colLabels",
  "footnotes",
  "tableName",
  "headerEntries",
  "footerEntries",
]);

function isRecord(value: unknown): value is Entry {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `_mod` accepts a single operation or a list of them, and `items` a single item or a list. */
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

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

function findParent(entries: Entry[], copy: Entry, keys: string[]): Entry | undefined {
  return entries.find((candidate) => keys.every((key) => candidate[key] === copy[key]));
}

function replaceText(node: unknown, pattern: RegExp, replacement: string): unknown {
  if (typeof node === "string") return node.replace(pattern, replacement);
  if (Array.isArray(node)) return node.map((child) => replaceText(child, pattern, replacement));
  if (!isRecord(node)) return node;
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [
      key,
      TEXT_KEYS.has(key) ? replaceText(value, pattern, replacement) : value,
    ]),
  );
}

/**
 * splice clamps, so an unchecked index past the end appends instead of landing
 * where the mod said, and `replaceArr` also leaves its target in place.
 * `insertArr` alone accepts `length`, since inserting there is an append.
 */
function checkIndex(index: number, list: unknown[], mode: string, context: string): number {
  const last = mode === "insertArr" ? list.length : list.length - 1;
  if (index < -list.length || index > last) {
    throw new Error(`${context}: ${mode} index ${index} is outside a list of ${list.length}`);
  }
  return index;
}

/** `replace` is either the `name` of the element to swap out or an explicit `{ index }`. */
function replaceIndex(list: unknown[], replace: unknown, context: string): number {
  if (isRecord(replace) && typeof replace.index === "number") {
    return checkIndex(replace.index, list, "replaceArr", context);
  }
  const index = list.findIndex((item) => isRecord(item) && item.name === replace);
  if (index === -1) {
    throw new Error(`${context}: replaceArr matched no element named "${String(replace)}"`);
  }
  return index;
}

const ARRAY_MODES = new Set(["appendArr", "prependArr", "insertArr", "replaceArr"]);

function applyOperation(entry: Entry, property: string, op: Entry, context: string): void {
  const target = entry[property];
  const splices = ARRAY_MODES.has(String(op.mode));
  // Appending to a property the parent lacks is normal. Present and not a list
  // means the mod and the data disagree, where `[]` would drop the value.
  if (splices && target !== undefined && !Array.isArray(target)) {
    throw new Error(`${context}: _mod.${property} expects a list, found ${typeof target}`);
  }
  const list = Array.isArray(target) ? [...target] : [];
  // Splicing a missing `items` inserts a literal `undefined`, stored as NULL.
  // Only for known modes, so an unrecognized one reports as unrecognized.
  if (splices && op.items === undefined) {
    throw new Error(`${context}: ${String(op.mode)} needs items`);
  }
  const items = asArray(op.items);
  switch (op.mode) {
    case "appendArr":
      entry[property] = [...list, ...items];
      return;
    case "prependArr":
      entry[property] = [...items, ...list];
      return;
    case "insertArr":
      if (typeof op.index !== "number") throw new Error(`${context}: insertArr needs an index`);
      list.splice(checkIndex(op.index, list, "insertArr", context), 0, ...items);
      entry[property] = list;
      return;
    case "replaceArr":
      list.splice(replaceIndex(list, op.replace, context), 1, ...items);
      entry[property] = list;
      return;
    case "replaceTxt": {
      if (typeof op.replace !== "string" || typeof op.with !== "string") {
        throw new Error(`${context}: replaceTxt needs a string "replace" and "with"`);
      }
      // Rewriting an absent property assigns `undefined`, stored as NULL.
      if (target === undefined) {
        throw new Error(`${context}: replaceTxt has no ${property} to rewrite`);
      }
      const flags = typeof op.flags === "string" ? op.flags : "";
      const pattern = new RegExp(op.replace, `g${flags}`);
      entry[property] = replaceText(target, pattern, op.with);
      return;
    }
    default:
      throw new Error(`${context}: unsupported _mod mode "${String(op.mode)}"`);
  }
}

function applyMod(entry: Entry, mod: Entry, context: string): void {
  for (const [property, operations] of Object.entries(mod)) {
    // `*` means every property, `_` the entry itself — both bestiary shapes. As
    // literal property names they would write a bogus key and drop the edit.
    if (property === "*" || property === "_") {
      throw new Error(`${context}: unsupported _mod property "${property}"`);
    }
    for (const op of asArray(operations)) {
      if (!isRecord(op)) throw new Error(`${context}: _mod.${property} is not an operation`);
      applyOperation(entry, property, op, context);
    }
  }
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
    const parent = findParent(entries, copy, keys);
    if (!parent) {
      throw new Error(
        `${context}: ${describe(entry, keys)} copies ${describe(copy, keys)}, which no entry in the file matches`,
      );
    }
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
