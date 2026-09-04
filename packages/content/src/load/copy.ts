/**
 * Resolves 5etools `_copy` inheritance, so loaders only ever see complete records.
 *
 * An entry carrying a `_copy` block is a diff against another entry in the same
 * file. The block names the parent by the identity fields it lists, `_mod`
 * describes edits to apply after the clone, and `_preserve` names the parent
 * metadata that survives the copy. `_meta.internalCopies` names the properties
 * that need any of this, which is why no entity type is hardcoded here.
 *
 * `resolveCopies` is pure: it returns a new source with the copies resolved and
 * the `_copy` blocks stripped, and throws on a cycle or a missing parent rather
 * than leaving a half-inherited record for a loader to import.
 *
 * A parent is only ever looked up in the same file, and matched on the fields it
 * declares rather than ones it would inherit. That covers every
 * character-relevant source. Bestiary entries copy across files and would fail
 * here — loudly, which is the point.
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
 * Keys whose values `replaceTxt` descends into — every string-valued key that
 * holds prose anywhere in the vendored entry trees.
 *
 * An allowlist rather than a blocklist, because the strings it leaves alone are
 * not only structural (`type`, `style`, `colStyles`) but referential:
 * `subclassFeature`, `reprintedAs` and `data.overwrite` hold `Name|Source|...`
 * pointers at other entries, and rewriting the prose must not rewrite a link.
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

// ponytail: a linear scan per copy — the heaviest file is 199 class copies against
// ~600 features. Upgrade path is one index per identity-key shape, built once.
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

/** `replace` is either the `name` of the element to swap out or an explicit `{ index }`. */
function replaceIndex(list: unknown[], replace: unknown, context: string): number {
  if (isRecord(replace) && typeof replace.index === "number") return replace.index;
  const index = list.findIndex((item) => isRecord(item) && item.name === replace);
  if (index === -1) {
    throw new Error(`${context}: replaceArr matched no element named "${String(replace)}"`);
  }
  return index;
}

/** The `_mod` modes that splice into an array, all of which require `items`. */
const ARRAY_MODES = new Set(["appendArr", "prependArr", "insertArr", "replaceArr"]);

function applyOperation(entry: Entry, property: string, op: Entry, context: string): void {
  const list = Array.isArray(entry[property]) ? [...entry[property]] : [];
  // Every array mode carries `items`. Without this an upstream key rename would
  // splice a literal `undefined` into the entry and store it as null. Scoped to
  // the known modes so an unrecognized one still reports as unrecognized.
  if (ARRAY_MODES.has(String(op.mode)) && op.items === undefined) {
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
      list.splice(op.index, 0, ...items);
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
      const flags = typeof op.flags === "string" ? op.flags : "";
      const pattern = new RegExp(op.replace, `g${flags}`);
      entry[property] = replaceText(entry[property], pattern, op.with);
      return;
    }
    default:
      throw new Error(`${context}: unsupported _mod mode "${String(op.mode)}"`);
  }
}

function applyMod(entry: Entry, mod: Entry, context: string): void {
  for (const [property, operations] of Object.entries(mod)) {
    // `*` means every property and `_` means the entry itself. Both are bestiary
    // shapes; treating either as a literal property name would write a bogus key
    // and drop the edit, so refuse them the way an unknown mode is refused.
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

function resolveEntries(entries: Entry[], context: string): Entry[] {
  const resolved = new Map<Entry, Entry>();
  const visiting = new Set<Entry>();

  const resolve = (entry: Entry): Entry => {
    const cached = resolved.get(entry);
    if (cached) return cached;

    const copy = isRecord(entry._copy) ? entry._copy : undefined;
    if (!copy) {
      resolved.set(entry, entry);
      return entry;
    }

    const keys = identityKeys(copy);
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
 * Throws if a top-level entry still carries a `_copy`, which means the file
 * needed resolving and `_meta.internalCopies` did not say so. Dozens of bestiary
 * files are like that. Without this the gate below would hand a loader the diff
 * instead of the record, in silence — the one failure this module exists to
 * prevent.
 */
function assertResolved(source: Entry, label: string): void {
  for (const [property, entries] of Object.entries(source)) {
    if (!Array.isArray(entries)) continue;
    const unresolved = entries.filter((entry) => isRecord(entry) && isRecord(entry._copy));
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
