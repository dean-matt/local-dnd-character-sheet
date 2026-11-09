import { alignmentWords } from "@dnd/catalog";
import { capitalize } from "../../lib/capitalize.ts";
import { isRecord } from "../../lib/entryGuards.ts";
import { entriesOf } from "./homebrewEntry.ts";

export const MONSTER_SPEED_MODES = ["walk", "burrow", "climb", "fly", "swim"] as const;

export type MonsterSpeedMode = (typeof MONSTER_SPEED_MODES)[number];

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** A speed in feet: upstream writes either the number or `{number, condition}`. */
const feetOf = (value: unknown): number | undefined =>
  finite(value) ? value : isRecord(value) && finite(value.number) ? value.number : undefined;

/** The feet a monster's `speed` states for `mode`. */
export const speedFeet = (speed: unknown, mode: MonsterSpeedMode): number | undefined =>
  isRecord(speed) ? feetOf(speed[mode]) : undefined;

/**
 * `speed` with `mode` set to `feet`, or dropped where `feet` is `undefined`; a conditional
 * speed keeps its condition. An empty speed stays `{}` so the schema's "A speed" reason shows.
 */
export function withSpeed(
  speed: unknown,
  mode: MonsterSpeedMode,
  feet: number | undefined,
): Record<string, unknown> {
  const stated = isRecord(speed) ? speed : {};
  const { [mode]: old, ...rest } = stated;
  if (feet === undefined) return rest;
  return { ...rest, [mode]: isRecord(old) ? { ...old, number: feet } : feet };
}

/** The first armor class as the form edits it: a number, or `{ac}` upstream writes for a source. */
export function firstArmorClass(ac: unknown): number | undefined {
  const [first] = Array.isArray(ac) ? ac : [];
  return finite(first) ? first : isRecord(first) && finite(first.ac) ? first.ac : undefined;
}

const proseOf = (one: unknown): string | undefined =>
  isRecord(one) && typeof one.special === "string" && !finite(one.ac) ? one.special : undefined;

/** The first armor class's words where it is stated as prose: `13 + PB (natural armor)`. */
export const firstArmorClassWords = (ac: unknown): string | undefined =>
  proseOf(Array.isArray(ac) ? ac[0] : undefined);

/** `ac` with its first entry's words set to `words`, keeping the rest of the list. */
export function withArmorClassWords(ac: unknown, words: string): unknown[] {
  const [first, ...rest] = Array.isArray(ac) ? ac : [];
  return [{ ...(isRecord(first) ? first : {}), special: words }, ...rest];
}

/**
 * `ac` with its first entry's number set to `value`, keeping the rest of the list and any
 * source the first carries; the list is dropped when no number is left to hold.
 */
export function withArmorClass(ac: unknown, value: number | undefined): unknown[] | undefined {
  const [first, ...rest] = Array.isArray(ac) ? ac : [];
  if (value === undefined) return rest.length > 0 ? rest : undefined;
  return [isRecord(first) ? { ...first, ac: value } : value, ...rest];
}

/** The challenge rating text, whether written plainly or as `{cr}`. */
export const ratingOf = (cr: unknown): string =>
  typeof cr === "string" ? cr : isRecord(cr) && typeof cr.cr === "string" ? cr.cr : "";

/** `cr` with its rating replaced, keeping a lair or coven rating beside it. */
export const withRating = (cr: unknown, rating: string): unknown =>
  isRecord(cr) ? { ...cr, cr: rating } : rating;

/** The alignments the form offers, as the letters upstream writes: the nine, unaligned, any, then the ranges. */
export const MONSTER_ALIGNMENTS: string[][] = [
  ["L", "G"],
  ["NX", "G"],
  ["C", "G"],
  ["L", "NY"],
  ["N"],
  ["C", "NY"],
  ["L", "E"],
  ["NX", "E"],
  ["C", "E"],
  ["U"],
  ["A"],
  ["L", "NX", "C", "G"],
  ["L", "NX", "C", "E"],
  ["L", "NX", "C", "NY", "G"],
  ["L", "NX", "C", "NY", "E"],
  ["L", "G", "NY", "E"],
  ["C", "G", "NY", "E"],
  ["NX", "C", "G", "NY", "E"],
  ["L", "NX", "G", "NY", "E"],
];

/**
 * `letters` as the stat block reads them, in sentence case. Letters that read alike share a
 * label, so `["N", "E"]` and `["NX", "E"]` are both "Neutral evil".
 */
export const alignmentLabel = (letters: string[]): string => capitalize(alignmentWords(letters));

/** The option that states an alignment in words rather than letters. */
export const ALIGNMENT_IN_WORDS = "Described in words";

/** One alignment a monster may have, as the form edits it. */
export interface AlignmentRow {
  letters?: string[];
  /** The alignment in words, where the row states prose; it wins over `letters`. */
  special?: string;
  /** The percentage chance a choice of alignments gives this one. */
  chance?: number;
  note: string;
  /** The entry as stored, so a key the form does not edit survives an edit. */
  stored: unknown;
}

const isLetters = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((each) => typeof each === "string");

const isChoice = (part: unknown): part is Record<string, unknown> =>
  isRecord(part) && (isLetters(part.alignment) || typeof part.special === "string");

/** True where the form shows `alignment`: none, letters, or a choice of letters or prose. */
export const alignmentIsEditable = (alignment: unknown): boolean =>
  alignment === undefined ||
  isLetters(alignment) ||
  (Array.isArray(alignment) && alignment.every(isChoice));

/** The rows `alignment` states: one for letters, one per choice; none where the form cannot show it. */
export function alignmentRows(alignment: unknown): AlignmentRow[] {
  if (!Array.isArray(alignment) || alignment.length === 0 || !alignmentIsEditable(alignment)) {
    return [];
  }
  if (isLetters(alignment)) return [{ letters: alignment, note: "", stored: alignment }];
  return alignment.filter(isChoice).map((part) => ({
    letters: isLetters(part.alignment) ? part.alignment : undefined,
    special: typeof part.special === "string" ? part.special : undefined,
    chance: finite(part.chance) ? part.chance : undefined,
    note: typeof part.note === "string" ? part.note : "",
    stored: part,
  }));
}

/**
 * The `alignment` `rows` state: plain letters for one row with nothing beside them, otherwise a
 * choice. A row with neither letters nor words writes nothing; `undefined` where nothing is left.
 */
export function withAlignmentRows(rows: AlignmentRow[]): unknown[] | undefined {
  const written = rows.flatMap(
    ({ letters, special, chance, note, stored }): Record<string, unknown>[] => {
      const {
        alignment: _alignment,
        special: _special,
        chance: _chance,
        note: _note,
        ...rest
      } = isRecord(stored) && !Array.isArray(stored) ? stored : ({} as Record<string, unknown>);
      if (special !== undefined)
        return special.trim() ? [{ ...rest, special: special.trim() }] : [];
      if (!letters) return [];
      return [
        {
          ...rest,
          alignment: letters,
          ...(chance === undefined ? {} : { chance }),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      ];
    },
  );
  const [only] = written;
  if (written.length === 1 && only && Object.keys(only).length === 1 && isLetters(only.alignment)) {
    return only.alignment;
  }
  return written.length > 0 ? written : undefined;
}

/** `alignmentPrefix` as the form shows it, without the space before the alignment. */
export const prefixText = (prefix: unknown): string =>
  typeof prefix === "string" ? prefix.trimEnd() : "";

/** The `alignmentPrefix` `text` states, ending in the space the stat block reads it with. */
export const withPrefix = (text: string): string | undefined =>
  text.trim() ? `${text.trim()} ` : undefined;

/** The strings among `list`, for a row list that edits them and keeps anything else. */
export const stringsIn = (list: unknown): string[] =>
  Array.isArray(list) ? list.filter((each): each is string => typeof each === "string") : [];

/**
 * `list` with the items `editable` accepts replaced by `next`, each in the slot of the one it
 * replaces, so an item the form cannot edit keeps its place. Surplus slots are dropped and
 * surplus replacements follow the last slot.
 */
function replaceEditable<T>(
  list: unknown[],
  editable: (item: unknown) => boolean,
  next: T[],
): unknown[] {
  const out: unknown[] = [];
  let used = 0;
  let after = -1;
  for (const item of list) {
    if (editable(item)) {
      if (used < next.length) out.push(next[used++]);
      after = out.length;
    } else {
      out.push(item);
    }
  }
  out.splice(after < 0 ? out.length : after, 0, ...next.slice(used));
  return out;
}

/**
 * `list` with its strings replaced by the non-blank `strings`, trimmed, in the slots they held;
 * the entries that are not strings keep their places.
 * `undefined` where nothing is left.
 */
export function withStrings(list: unknown, strings: string[]): unknown[] | undefined {
  const next = replaceEditable(
    Array.isArray(list) ? list : [],
    (each) => typeof each === "string",
    strings.map((each) => each.trim()).filter(Boolean),
  );
  return next.length > 0 ? next : undefined;
}

/** A creature type tag as the form edits it, with a blank `prefix` where it has none. */
export interface TypeTagRow {
  tag: string;
  prefix: string;
  /** The tag as stored, so a key the form does not edit survives an edit. */
  stored: unknown;
}

const isTypeTag = (item: unknown): boolean =>
  typeof item === "string" || (isRecord(item) && typeof item.tag === "string");

/** The tags a type states, plain or prefixed; any other shape is left to JSON. */
export function typeTagRows(type: unknown): TypeTagRow[] {
  if (!isRecord(type) || !Array.isArray(type.tags)) return [];
  return type.tags.filter(isTypeTag).map((item) =>
    isRecord(item)
      ? {
          tag: String(item.tag),
          prefix: typeof item.prefix === "string" ? item.prefix : "",
          stored: item,
        }
      : { tag: String(item), prefix: "", stored: item },
  );
}

/** The tag `row` states: a string where nothing but the tag is left; nothing where it is blank. */
function typeTag({ tag, prefix, stored }: TypeTagRow): unknown[] {
  if (!tag.trim()) return [];
  const { tag: _tag, prefix: _prefix, ...rest } = isRecord(stored) ? stored : {};
  if (!prefix.trim() && Object.keys(rest).length === 0) return [tag.trim()];
  return [{ ...rest, tag: tag.trim(), ...(prefix.trim() ? { prefix: prefix.trim() } : {}) }];
}

/**
 * `type` with `key` set to `value`, or removed where it is `undefined`. A plain type becomes
 * `{type, key}`, and goes back to plain when nothing else is left on it.
 */
export function withTypeField(type: unknown, key: string, value: unknown): unknown {
  const stated = isRecord(type) ? type : { type };
  const { [key]: _old, ...rest } = stated;
  if (value !== undefined) return { ...rest, [key]: value };
  return Object.keys(rest).length === 1 && typeof rest.type === "string" ? rest.type : rest;
}

/** `type` with its tags replaced by `rows`, in their slots, so a tag in another shape keeps its place. */
export function withTypeTags(type: unknown, rows: TypeTagRow[]): unknown {
  const stated = isRecord(type) && Array.isArray(type.tags) ? type.tags : [];
  const next = replaceEditable(stated, isTypeTag, rows.flatMap(typeTag));
  return withTypeField(type, "tags", next.length > 0 ? next : undefined);
}

/** An armor class beyond the first as the form edits it. */
export interface ExtraArmorClass {
  ac: number | undefined;
  /** What it comes from, as written beside the number: `natural armor`. */
  source: string;
  /** The armor class in words where it is stated as prose, in place of a number and source. */
  special?: string;
  /** The entry as stored, so a condition or brackets it carries survive an edit. */
  stored: unknown;
}

const editableArmorClass = (one: unknown): boolean =>
  finite(one) || (isRecord(one) && finite(one.ac)) || proseOf(one) !== undefined;

/** The armor classes after the first that hold a number or prose, in their stored order. */
export function extraArmorClasses(ac: unknown): ExtraArmorClass[] {
  return (Array.isArray(ac) ? ac.slice(1) : []).filter(editableArmorClass).map((one) => ({
    ac: finite(one) ? one : isRecord(one) && finite(one.ac) ? one.ac : undefined,
    source: isRecord(one) ? stringsIn(one.from).join(", ") : "",
    special: proseOf(one),
    stored: one,
  }));
}

/**
 * `ac` with the editable armor classes after the first replaced by `rows`, in their slots. A
 * prose row writes its words; a row with no number yet writes nothing; one with no source is a
 * plain number.
 */
export function withExtraArmorClasses(ac: unknown, rows: ExtraArmorClass[]): unknown[] | undefined {
  const [first, ...others] = Array.isArray(ac) ? ac : [];
  const written = rows.flatMap(({ ac: value, source, special, stored }): unknown[] => {
    if (special !== undefined) return [{ ...(isRecord(stored) ? stored : {}), special }];
    if (value === undefined) return [];
    const { from: _from, ac: _ac, ...rest } = isRecord(stored) ? stored : {};
    const keep = source
      .split(",")
      .map((each) => each.trim())
      .filter(Boolean);
    return [
      keep.length > 0 || Object.keys(rest).length > 0
        ? { ...rest, ac: value, ...(keep.length > 0 ? { from: keep } : {}) }
        : value,
    ];
  });
  const next = [
    ...(first === undefined ? [] : [first]),
    ...replaceEditable(others, editableArmorClass, written),
  ];
  return next.length > 0 ? next : undefined;
}

/** The groups of text rows a monster's stat block lists, each under the key it is stored at. */
export type MonsterTextGroup = "trait" | "action" | "bonus" | "reaction" | "legendary" | "mythic";

const isPlainList = (entry: unknown): entry is Record<string, unknown> & { items: string[] } =>
  isRecord(entry) &&
  !Array.isArray(entry) &&
  entry.type === "list" &&
  Array.isArray(entry.items) &&
  entry.items.every((each) => typeof each === "string");

const isPlainSection = (
  entry: unknown,
): entry is Record<string, unknown> & { name?: string; entries?: string[] } =>
  isRecord(entry) &&
  !Array.isArray(entry) &&
  entry.type === "entries" &&
  (entry.name === undefined || typeof entry.name === "string") &&
  (entry.entries === undefined ||
    (Array.isArray(entry.entries) && entry.entries.every((each) => typeof each === "string")));

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((each) => typeof each === "string");

type PlainTable = Record<string, unknown> & {
  caption?: string;
  colLabels?: string[];
  rows: string[][];
};

const isPlainTable = (entry: unknown): entry is PlainTable =>
  isRecord(entry) &&
  !Array.isArray(entry) &&
  entry.type === "table" &&
  (entry.caption === undefined || typeof entry.caption === "string") &&
  (entry.colLabels === undefined || isStrings(entry.colLabels)) &&
  Array.isArray(entry.rows) &&
  entry.rows.every(isStrings);

/**
 * One part of a row's rules text as the form edits it: paragraphs, a list of plain items, a
 * table of text cells, or a named section of paragraphs.
 */
export type RulesPart =
  | { text: string }
  | {
      items: string[];
      /** The list as stored, so its style survives an edit. */
      stored: Record<string, unknown>;
    }
  | {
      caption: string;
      /** One per column, blank where the table has no label for it. */
      labels: string[];
      /** Each row as long as `labels`. */
      rows: string[][];
      /** The table as stored, so its other fields survive an edit. */
      stored: Record<string, unknown>;
    }
  | {
      name: string;
      /** The section's paragraphs, a blank line between each. */
      body: string;
      /** The section as stored, so its other fields survive an edit. */
      stored: Record<string, unknown>;
    };

function tablePart(entry: PlainTable): RulesPart {
  const labels = entry.colLabels ?? [];
  const width = Math.max(labels.length, ...entry.rows.map((row) => row.length));
  const pad = (cells: string[]) => [...cells, ...Array<string>(width - cells.length).fill("")];
  return {
    caption: entry.caption ?? "",
    labels: pad(labels),
    rows: entry.rows.map(pad),
    stored: entry,
  };
}

/**
 * The parts `entries` states, paragraphs first and after every list or section, blank where none
 * are stored, so text can be written on either side of each. `undefined` where an entry is
 * neither a string, a list of strings, a table of strings nor a section of strings.
 */
export function rulesParts(entries: unknown): RulesPart[] | undefined {
  if (entries === undefined) return [{ text: "" }];
  if (!Array.isArray(entries)) return undefined;
  const parts: RulesPart[] = [];
  let text: string[] = [];
  for (const entry of entries) {
    if (typeof entry === "string") {
      text.push(entry);
      continue;
    }
    if (isPlainList(entry))
      parts.push({ text: text.join("\n\n") }, { items: entry.items, stored: entry });
    else if (isPlainTable(entry)) parts.push({ text: text.join("\n\n") }, tablePart(entry));
    else if (isPlainSection(entry))
      parts.push(
        { text: text.join("\n\n") },
        { name: entry.name ?? "", body: (entry.entries ?? []).join("\n\n"), stored: entry },
      );
    else return undefined;
    text = [];
  }
  return [...parts, { text: text.join("\n\n") }];
}

export type TablePart = Extract<RulesPart, { rows: string[][] }>;

/** The table `part` states; nothing where its caption, labels and cells are all blank. */
function tableEntry({ caption, labels, rows, stored }: TablePart): unknown[] {
  const trimmed = (cells: string[]) => cells.map((each) => each.trim());
  const table: Record<string, unknown> = {
    ...stored,
    caption: caption.trim(),
    colLabels: trimmed(labels),
    rows: rows.map(trimmed),
  };
  if (!caption.trim()) delete table.caption;
  if (!labels.some((each) => each.trim())) delete table.colLabels;
  if (!table.caption && !table.colLabels && rows.every((row) => row.every((cell) => !cell.trim())))
    return [];
  return [table];
}

/** The list `part` states; nothing where no item is left. */
function listEntry({ items, stored }: Extract<RulesPart, { items: string[] }>): unknown[] {
  const kept = items.map((each) => each.trim()).filter(Boolean);
  return kept.length > 0 ? [{ ...stored, items: kept }] : [];
}

/** `part` with the column at `at` removed from its labels, cells and any column styles. */
export function withoutColumn(part: TablePart, at: number): TablePart {
  const drop = <T>(cells: T[]) => cells.filter((_, index) => index !== at);
  const { colStyles } = part.stored;
  return {
    ...part,
    labels: drop(part.labels),
    rows: part.rows.map(drop),
    stored: Array.isArray(colStyles) ? { ...part.stored, colStyles: drop(colStyles) } : part.stored,
  };
}

/**
 * The `entries` `parts` state. Blank text, a blank item, a list with no items, a table with
 * no text and a section with neither name nor paragraphs write nothing.
 */
export function entriesOfParts(parts: RulesPart[]): unknown[] | undefined {
  const entries = parts.flatMap((part): unknown[] => {
    if ("text" in part) return entriesOf(part.text) ?? [];
    if ("items" in part) return listEntry(part);
    if ("rows" in part) return tableEntry(part);
    const name = part.name.trim();
    const body = entriesOf(part.body);
    if (!name && !body) return [];
    const section: Record<string, unknown> = { ...part.stored, name, entries: body ?? [] };
    if (!name) delete section.name;
    return [section];
  });
  return entries.length > 0 ? entries : undefined;
}

/**
 * True where a trait or action is a name and rules text of paragraphs, lists of plain items,
 * tables of text and sections of paragraphs, the shape the form edits.
 */
export const isPlainTextRow = (item: unknown): item is { name?: string; entries?: unknown[] } =>
  isRecord(item) &&
  !Array.isArray(item) &&
  (item.name === undefined || typeof item.name === "string") &&
  rulesParts(item.entries) !== undefined;

/** `list` with the item at `from` moved to `to`; the list itself where either is out of range. */
export function moved<T>(list: T[], from: number, to: number): T[] {
  if (from === to || to < 0 || to >= list.length || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}
