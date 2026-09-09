/**
 * Applies a 5etools `_mod` block to an entry.
 *
 * Both inheritance mechanisms in the data carry one: `_copy` merges a parent
 * into a child and then mods the result, and `_versions` mods a clone of the
 * entry per variant. The modes are the same in both, so they are applied here
 * and neither mechanism owns them.
 *
 * Anything unrecognized throws. A mode this does not implement is a mode whose
 * effect nobody has checked, and half-applying it writes an entry that looks
 * complete.
 */
import { type Entry, isRecord } from "./json.ts";

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

/** `_mod` accepts a single operation or a list of them, and `items` a single item or a list. */
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
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

const ARRAY_MODES = new Set(["appendArr", "prependArr", "insertArr", "replaceArr", "removeArr"]);

/** Every mode but `removeArr` splices something in, and needs `items` to do it. */
const NEEDS_ITEMS = new Set(["appendArr", "prependArr", "insertArr", "replaceArr"]);

/**
 * A property the entry does not carry is nothing to remove from, and the end
 * state is what the mod asked for either way: the PHB Dragonborn subrace
 * removes "Draconic Ancestry", which upstream renders from the parent race
 * rather than storing on the subrace. A name absent from a list that *is* here
 * stays an error, so a typo is still caught.
 */
function removeNamed(
  entry: Entry,
  property: string,
  target: unknown,
  list: unknown[],
  op: Entry,
  context: string,
): void {
  const names = new Set(asArray(op.names).map(String));
  if (names.size === 0) throw new Error(`${context}: removeArr needs names`);
  if (target === undefined) return;
  const kept = list.filter((item) => !(isRecord(item) && names.has(String(item.name))));
  const removed = list.length - kept.length;
  if (removed < names.size) {
    throw new Error(
      `${context}: removeArr matched ${removed} of ${names.size} named elements in ${property}`,
    );
  }
  entry[property] = kept;
}

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
  if (NEEDS_ITEMS.has(String(op.mode)) && op.items === undefined) {
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
    case "removeArr":
      removeNamed(entry, property, target, list, op, context);
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

export function applyMod(entry: Entry, mod: Entry, context: string): void {
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
