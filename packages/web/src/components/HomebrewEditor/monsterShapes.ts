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

/** True where the first armor class is stated as prose, which the form leaves to JSON. */
export const armorClassIsProse = (ac: unknown): boolean => {
  const [first] = Array.isArray(ac) ? ac : [];
  return isRecord(first) && first.special !== undefined && !finite(first.ac);
};

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
 * the entries that are not strings, such as a tag with a prefix, keep their places.
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

/** The tags a type states: its strings only; a tag with a prefix is left to JSON. */
export const typeTags = (type: unknown): string[] => (isRecord(type) ? stringsIn(type.tags) : []);

/**
 * `type` with its string tags replaced by `tags`. A plain type becomes `{type, tags}` for its
 * first tag, and goes back to plain when nothing else is left on it.
 */
export function withTypeTags(type: unknown, tags: string[]): unknown {
  const stated = isRecord(type) ? type : { type };
  const next = withStrings(stated.tags, tags);
  const { tags: _old, ...rest } = stated;
  if (next) return { ...rest, tags: next };
  return Object.keys(rest).length === 1 && typeof rest.type === "string" ? rest.type : rest;
}

/** An armor class beyond the first as the form edits it. */
export interface ExtraArmorClass {
  ac: number | undefined;
  /** What it comes from, as written beside the number: `natural armor`. */
  source: string;
  /** The entry as stored, so a condition or brackets it carries survive an edit. */
  stored: unknown;
}

const editableArmorClass = (one: unknown): boolean =>
  finite(one) || (isRecord(one) && finite(one.ac));

/** The armor classes after the first that hold a number; prose ones are left to JSON. */
export function extraArmorClasses(ac: unknown): ExtraArmorClass[] {
  return (Array.isArray(ac) ? ac.slice(1) : []).filter(editableArmorClass).map((one) => ({
    ac: finite(one) ? one : (one as { ac: number }).ac,
    source: isRecord(one) ? stringsIn(one.from).join(", ") : "",
    stored: one,
  }));
}

/** True where armor classes after the first are prose, which the form leaves to JSON. */
export const hasProseExtraArmorClass = (ac: unknown): boolean =>
  Array.isArray(ac) && ac.slice(1).some((one) => !editableArmorClass(one));

/**
 * `ac` with the editable armor classes after the first replaced by `rows`, the prose ones
 * kept behind them. A row with no number yet writes nothing; one with no source is a plain number.
 */
export function withExtraArmorClasses(ac: unknown, rows: ExtraArmorClass[]): unknown[] | undefined {
  const [first, ...others] = Array.isArray(ac) ? ac : [];
  const written = rows.flatMap(({ ac: value, source, stored }) => {
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

/** One part of a row's rules text as the form edits it: paragraphs, or a list of plain items. */
export type RulesPart =
  | { text: string }
  | {
      items: string[];
      /** The list as stored, so its style survives an edit. */
      stored: Record<string, unknown>;
    };

/**
 * The parts `entries` states, paragraphs first and after every list, blank where none are
 * stored, so text can be written on either side of each list. `undefined` where an entry is
 * neither a string nor a list of strings.
 */
export function rulesParts(entries: unknown): RulesPart[] | undefined {
  if (entries === undefined) return [{ text: "" }];
  if (!Array.isArray(entries)) return undefined;
  const parts: RulesPart[] = [];
  let text: string[] = [];
  for (const entry of entries) {
    if (typeof entry === "string") text.push(entry);
    else if (isPlainList(entry)) {
      parts.push({ text: text.join("\n\n") }, { items: entry.items, stored: entry });
      text = [];
    } else return undefined;
  }
  return [...parts, { text: text.join("\n\n") }];
}

/** The `entries` `parts` state; blank text, a blank item and a list with no items write nothing. */
export function entriesOfParts(parts: RulesPart[]): unknown[] | undefined {
  const entries = parts.flatMap((part): unknown[] => {
    if ("text" in part) return entriesOf(part.text) ?? [];
    const items = part.items.map((each) => each.trim()).filter(Boolean);
    return items.length > 0 ? [{ ...part.stored, items }] : [];
  });
  return entries.length > 0 ? entries : undefined;
}

/** True where a trait or action is a name and rules text of paragraphs and lists of plain items, the shape the form edits. */
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
