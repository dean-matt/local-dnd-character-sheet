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
  /** Fields that hold prose here, where the name alone does not say so. */
  prose?: string[];
  /** Fields that hold machine data here, where the name says prose everywhere else. */
  verbatim?: string[];
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
  "pantheon",
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

/**
 * A field whose value is rules prose, all the way down, whatever holds it.
 *
 * A field that reads as prose under one entry and as machine data under another
 * stays here and is exempted where it does not — `focus` is a psionic's
 * discipline text and an item group's list of classes. Elision is the safe
 * default of the two: a fixture that forgets to name a field loses coverage,
 * where the reverse commits WotC's prose. See NOTICE.
 */
const PROSE_FIELDS = ["entries", "entriesHigherLevel", "entry", "focus"];

/**
 * Keys that stay verbatim inside a prose tree, because a loader reads them: an
 * element's name and type, a `_mod` operation's operands, a link's target. Anything
 * else under a prose field is text, wherever it sits and whatever holds it.
 */
const STRUCTURAL_FIELDS = [
  ...IDENTITY_FIELDS,
  "type",
  "style",
  "caption",
  "overwrite",
  "colLabels",
  "colStyles",
  "shortName",
  "tableDisplayName",
  "mode",
  "names",
  "replace",
  "with",
  "flags",
  "href",
  "path",
  "hash",
];

/** What replaces every run of prose. Short, and obviously not upstream's. */
const MARKER = "Elided.";

/**
 * Markup a loader reads rather than renders: a `{@tag}` and a version's `{{variable}}`.
 * Both survive elision, because a fixture with no tags cannot exercise tag handling,
 * and neither carries rules text.
 */
const MARKUP = /\{@[^{}]+\}|\{\{[^{}]+\}\}/g;

/**
 * Tags that wrap prose rather than name something. Their body is rules text, so a
 * whole paragraph inside one is not markup that may stay — only the tag itself is.
 */
const FORMATTING_TAGS = new Set([
  "b",
  "bold",
  "code",
  "color",
  "comic",
  "comicH1",
  "comicH2",
  "comicH3",
  "comicNote",
  "font",
  "footnote",
  "handwriting",
  "highlight",
  "i",
  "italic",
  "note",
  "s",
  "strike",
  "sub",
  "sup",
  "u",
  "underline",
]);

/**
 * A backstop, not the rule: the list above is what actually separates prose from a
 * name. Upstream adds tags faster than any list here is maintained, so a body too long
 * to be a name is refused rather than guessed at — guessing "reference" leaks prose and
 * guessing "prose" loses a reference. Set above the longest legitimate reference in the
 * declared files, a 170-character `{@filter}` query, so it only catches a tag the list
 * has yet to learn. A short unrecognised one still slips; only the list closes that.
 */
const REFERENCE_CEILING = 200;

/** A tag whose body is prose, reduced to the tag. */
function elideTag(markup: string): string {
  const name = markup.slice(2).split(/[\s|}]/, 1)[0] ?? "";
  if (FORMATTING_TAGS.has(name)) return `{@${name} ${MARKER}}`;
  const body = markup.slice(3 + name.length, -1);
  if (body.length > REFERENCE_CEILING) {
    throw new Error(
      `{@${name}} carries ${body.length} characters, too long to take for a name. ` +
        "Add it to FORMATTING_TAGS if its body is prose, or raise REFERENCE_CEILING if it is not.",
    );
  }
  return markup;
}

/** Prose, with the markup a loader reads left where it stood. */
export function elide(text: string): string {
  const parts: string[] = [];
  let read = 0;
  for (const match of text.matchAll(MARKUP)) {
    if (text.slice(read, match.index).trim()) parts.push(MARKER);
    parts.push(elideTag(match[0]));
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

/** Every field a selection names has to be there, or it is addressing nothing. */
function requirePresent(
  node: Record<string, unknown>,
  fields: string[],
  where: string,
  purpose: string,
): void {
  for (const field of fields) {
    if (!(field in node)) throw new Error(`${where}: upstream has no field ${field}${purpose}`);
  }
}

function requireFields(node: Record<string, unknown>, selection: Selection, where: string): void {
  const prose = selection.prose ?? [];
  const verbatim = selection.verbatim ?? [];
  requirePresent(node, selection.fields ?? [], where, "");
  requirePresent(node, Object.keys(selection.within ?? {}), where, " to select in");
  requirePresent(node, prose, where, " to elide");
  requirePresent(node, verbatim, where, " to keep");

  for (const field of prose) {
    if (STRUCTURAL_FIELDS.includes(field)) {
      throw new Error(`${where}: ${field} is structural, so naming it prose does nothing`);
    }
  }
  for (const field of verbatim) {
    if (!PROSE_FIELDS.includes(field)) {
      throw new Error(`${where}: ${field} is not elided, so naming it verbatim does nothing`);
    }
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
    const named = PROSE_FIELDS.includes(field) || (selection.prose?.includes(field) ?? false);
    const kept = selection.verbatim?.includes(field) ?? false;
    const inProse = !kept && (prose || named) && !STRUCTURAL_FIELDS.includes(field);
    const within = selection.within?.[field] ?? {};
    out[field] = select(pruned, within, `${where}.${field}`, inProse);
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

/** Keys of a selection that only an object can answer, and the one only an array can. */
const OBJECT_KEYS = ["fields", "cols", "within", "prose", "verbatim", "set"] as const;

function shapeOf(node: unknown): { name: string; answers: readonly string[] } {
  if (Array.isArray(node)) return { name: "an array", answers: ["items"] };
  if (isRecord(node)) return { name: "an object", answers: OBJECT_KEYS };
  return { name: typeof node, answers: [] };
}

function requireShape(node: unknown, selection: Selection, where: string): void {
  const { name, answers } = shapeOf(node);
  const wrong = [...OBJECT_KEYS, "items"].filter(
    (key) => !answers.includes(key) && selection[key as keyof Selection] !== undefined,
  );
  if (wrong.length > 0) {
    throw new Error(`${where}: upstream holds ${name}, which ${wrong.join(" and ")} cannot select`);
  }
}

export function select(node: unknown, selection: Selection, where: string, prose = false): unknown {
  if (typeof node === "string") return prose ? elide(node) : node;
  if (Array.isArray(node)) {
    requireShape(node, selection, where);
    if (selection.items) return selectItems(node, selection.items, where, prose);
    // Descend even with nothing selected here: a prose field can sit under any array.
    return node.map((element, at) => select(element, {}, `${where}[${at}]`, prose));
  }
  if (isRecord(node)) {
    requireShape(node, selection, where);
    return selectFields(node, selection, where, prose);
  }
  requireShape(node, selection, where);
  return node;
}
