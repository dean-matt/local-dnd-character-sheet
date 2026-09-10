/**
 * Applies a fixture declaration to an upstream document.
 *
 * Every value in the result is copied from `vendor/`, except two. The declaration
 * says which parts survive — which entries, which fields, which table columns —
 * and an `Override` invents a value and says why upstream's will not do. The other
 * exception is rules prose, which is WotC's and is never committed (see NOTICE):
 * every string inside an `entries` tree is replaced by `MARKER`, so a fixture
 * exercises the shape of a document without carrying its text.
 *
 * A declaration that names something upstream no longer carries is refused rather
 * than quietly dropped, because a silently smaller fixture is a test that stopped
 * covering what it claims to.
 */

import { isRecord } from "../load/json.ts";

type Override = { value: unknown; why: string };

export type Selection = {
  /** Fields kept, in upstream order. Omit to keep every field. */
  fields?: string[];
  /** Table columns kept, by upstream label. Prunes `colLabels` and every row with them. */
  cols?: string[];
  /** Array elements kept, in upstream order. Omit to keep every element. */
  items?: Item[];
  /** Selections applied to a field's value. */
  within?: Record<string, Selection>;
  /** Values upstream does not carry, each saying why it has to be invented. */
  set?: Record<string, Override>;
};

/**
 * An array element: kept by identity or by index, or invented — which, like `set`,
 * has to say why upstream's elements will not do.
 */
type Item = string | number | ({ id: string | number } & Selection) | Override;

const isOverride = (item: Item): item is Override => typeof item === "object" && "why" in item;

/**
 * Fields that identify an entry, in the order they are joined. An entry is addressed
 * by the ones it carries: `Acid Splash|PHB|0`, `Death Domain|DMG|Cleric|PHB`.
 */
const IDENTITY_FIELDS = [
  "name",
  "source",
  "className",
  "classSource",
  "subclassShortName",
  "subclassSource",
  "raceName",
  "raceSource",
  "level",
  "classFeature",
  "id",
  "abbreviation",
];

/** A field whose value is rules prose, all the way down. */
const PROSE_FIELDS = ["entries", "entriesHigherLevel"];

/** What replaces every run of prose. Short, and obviously not upstream's. */
const MARKER = "Elided.";

/**
 * Markup a loader reads rather than renders: a `{@tag}` and a version's `{{variable}}`.
 * Both survive elision, because a fixture with no tags cannot exercise tag handling,
 * and neither carries rules text.
 */
const MARKUP = /\{@[^{}]+\}|\{\{[^{}]+\}\}/g;

/** Prose, with its markup left where it stood. */
export function elide(text: string): string {
  const parts: string[] = [];
  let read = 0;
  for (const match of text.matchAll(MARKUP)) {
    if (text.slice(read, match.index).trim()) parts.push(MARKER);
    parts.push(match[0]);
    read = match.index + match[0].length;
  }
  if (text.slice(read).trim()) parts.push(MARKER);
  return parts.join(" ");
}

/** Column metadata: pruned by `cols`, and structure rather than prose. */
const COLUMN_FIELDS = ["colLabels", "colStyles"];
const ROW_FIELDS = ["rows", "rowsSpellProgression"];

function identify(node: unknown): string | undefined {
  if (typeof node === "string") return node;
  if (!isRecord(node)) return undefined;
  const parts = IDENTITY_FIELDS.filter((field) => {
    const value = node[field];
    return typeof value === "string" || typeof value === "number";
  }).map((field) => String(node[field]));
  return parts.length === 0 ? undefined : parts.join("|");
}

function columnIndexes(node: Record<string, unknown>, cols: string[], where: string): number[] {
  const labels = node.colLabels;
  if (!Array.isArray(labels)) throw new Error(`${where}: cols needs a colLabels array`);
  const chosen = cols.map((col) => {
    const index = labels.indexOf(col);
    if (index === -1) throw new Error(`${where}: no column labelled ${JSON.stringify(col)}`);
    return index;
  });
  return chosen.sort((a, b) => a - b);
}

const atColumns = (row: unknown, indexes: number[]): unknown =>
  Array.isArray(row) ? indexes.map((index) => row[index]) : row;

function requireFields(node: Record<string, unknown>, selection: Selection, where: string): void {
  for (const field of selection.fields ?? []) {
    if (!(field in node)) throw new Error(`${where}: upstream has no field ${field}`);
  }
  for (const field of Object.keys(selection.within ?? {})) {
    if (!(field in node)) throw new Error(`${where}: upstream has no field ${field} to select in`);
  }
}

function pruneColumns(field: string, value: unknown, indexes: number[]): unknown {
  if (COLUMN_FIELDS.includes(field)) return atColumns(value, indexes);
  if (ROW_FIELDS.includes(field) && Array.isArray(value)) {
    return value.map((row) => atColumns(row, indexes));
  }
  return value;
}

function selectFields(
  node: Record<string, unknown>,
  selection: Selection,
  where: string,
  prose: boolean,
): Record<string, unknown> {
  requireFields(node, selection, where);
  const indexes = selection.cols ? columnIndexes(node, selection.cols, where) : undefined;

  const out: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(node)) {
    if (selection.fields && !selection.fields.includes(field)) continue;
    const pruned = indexes ? pruneColumns(field, value, indexes) : value;
    const inProse = (prose || PROSE_FIELDS.includes(field)) && !COLUMN_FIELDS.includes(field);
    const within = selection.within?.[field] ?? {};
    // A string a field holds is a name, a label or a type — prose is what an array holds.
    out[field] =
      typeof pruned === "string" ? pruned : select(pruned, within, `${where}.${field}`, inProse);
  }
  for (const [field, override] of Object.entries(selection.set ?? {})) out[field] = override.value;
  return out;
}

function selectItems(node: unknown[], items: Item[], where: string, prose: boolean): unknown[] {
  const taken = new Set<number>();
  return items.map((item) => {
    if (isOverride(item)) return item.value;
    const id = typeof item === "object" ? item.id : item;
    const index =
      typeof id === "number"
        ? id
        : node.findIndex((element, at) => !taken.has(at) && identify(element) === id);
    if (index < 0 || index >= node.length || taken.has(index)) {
      throw new Error(`${where}: upstream has no unclaimed element ${JSON.stringify(id)}`);
    }
    taken.add(index);
    const selection = typeof item === "object" ? item : {};
    return select(node[index], selection, `${where}[${id}]`, prose);
  });
}

export function select(node: unknown, selection: Selection, where: string, prose = false): unknown {
  if (typeof node === "string") return prose ? elide(node) : node;
  if (Array.isArray(node)) {
    if (selection.items) return selectItems(node, selection.items, where, prose);
    return prose ? node.map((element, at) => select(element, {}, `${where}[${at}]`, true)) : node;
  }
  if (isRecord(node)) return selectFields(node, selection, where, prose);
  return node;
}
