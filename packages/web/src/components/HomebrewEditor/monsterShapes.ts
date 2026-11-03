import { isRecord } from "../../lib/entryGuards.ts";

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

/** The alignments the form offers, each as the letters upstream writes. */
export const MONSTER_ALIGNMENTS: { label: string; letters: string[] }[] = [
  { label: "Lawful good", letters: ["L", "G"] },
  { label: "Neutral good", letters: ["NX", "G"] },
  { label: "Chaotic good", letters: ["C", "G"] },
  { label: "Lawful neutral", letters: ["L", "NY"] },
  { label: "Neutral", letters: ["N"] },
  { label: "Chaotic neutral", letters: ["C", "NY"] },
  { label: "Lawful evil", letters: ["L", "E"] },
  { label: "Neutral evil", letters: ["NX", "E"] },
  { label: "Chaotic evil", letters: ["C", "E"] },
  { label: "Unaligned", letters: ["U"] },
  { label: "Any alignment", letters: ["A"] },
];

/**
 * The label of the offered alignment `alignment` states, `""` where it states none, and
 * `undefined` where it is a range, a chance, a prefix or prose, which the form leaves to JSON.
 */
export function alignmentLabel(alignment: unknown, prefix: unknown): string | undefined {
  if (alignment === undefined) return prefix === undefined ? "" : undefined;
  if (prefix !== undefined || !Array.isArray(alignment)) return undefined;
  return MONSTER_ALIGNMENTS.find(
    ({ letters }) =>
      letters.length === alignment.length && letters.every((one, at) => one === alignment[at]),
  )?.label;
}

/** The strings among `list`, for a row list that edits them and keeps anything else. */
export const stringsIn = (list: unknown): string[] =>
  Array.isArray(list) ? list.filter((each): each is string => typeof each === "string") : [];

/**
 * `list` with its strings replaced by the non-blank `strings`, trimmed; the entries that are
 * not strings, such as a tag with a prefix, stay ahead of them. `undefined` where nothing is left.
 */
export function withStrings(list: unknown, strings: string[]): unknown[] | undefined {
  const kept = Array.isArray(list) ? list.filter((each) => typeof each !== "string") : [];
  const next = [...kept, ...strings.map((each) => each.trim()).filter(Boolean)];
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
    ...written,
    ...others.filter((one) => !editableArmorClass(one)),
  ];
  return next.length > 0 ? next : undefined;
}
