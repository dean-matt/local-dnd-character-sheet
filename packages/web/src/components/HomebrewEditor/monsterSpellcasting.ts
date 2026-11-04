import { isRecord } from "../../lib/entryGuards.ts";
import { entriesOf, paragraphsOf } from "./homebrewEntry.ts";

/** The per-use spell lists the form edits, keyed as upstream stores them. */
export const SPELL_FREQUENCIES = {
  daily: "Per day",
  rest: "Per rest",
  restLong: "Per long rest",
  charges: "Charges",
} as const;

export type SpellFrequencyKey = keyof typeof SPELL_FREQUENCIES;

const FREQUENCY_KEYS = Object.keys(SPELL_FREQUENCIES) as SpellFrequencyKey[];

/**
 * A count of uses as upstream keys it: `2`, or `2e` where each spell has its own uses. A
 * count below 1, or none, reads too, so the form shows the row the API refuses.
 */
const USES = /^(-?\d+)?(e?)$/;

/** One list of spells cast a number of times per day, per rest or for a cost in charges. */
export interface SpellFrequency {
  key: SpellFrequencyKey;
  uses: number | undefined;
  /** True where each spell has its own uses: `2/day each`. */
  each: boolean;
  /** Each spell as stored: a `{@spell}` string, or an entry upstream hides. */
  spells: unknown[];
}

/** The spells of one spell level and its slots. */
export interface SpellLevel {
  /** `0` for cantrips. */
  level: number;
  slots: number | undefined;
  spells: unknown[];
  /** The level as stored, so the bottom of a pact slot range survives an edit. */
  stored: Record<string, unknown>;
}

/** One spellcasting block as the form edits it. */
export interface SpellcastingForm {
  name: string;
  ability: string;
  displayAs: string;
  /** The text before and after the spell lists; `undefined` where it is more than paragraphs. */
  header: string | undefined;
  footer: string | undefined;
  will: unknown[];
  ritual: unknown[];
  frequencies: SpellFrequency[];
  levels: SpellLevel[];
}

/** An object keyed by name; an array is not one. */
const isObject = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) && !Array.isArray(value);

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** The block a new spellcasting entry starts as. */
export const NEW_SPELLCASTING = { name: "Spellcasting", type: "spellcasting" };

/** `block` as the form edits it. A frequency or level in a shape the form cannot read is not listed. */
export function readSpellcasting(block: Record<string, unknown>): SpellcastingForm {
  const frequencies = FREQUENCY_KEYS.flatMap((key) =>
    Object.entries(isObject(block[key]) ? block[key] : {}).flatMap(([uses, spells]) => {
      const match = USES.exec(uses);
      return match && Array.isArray(spells)
        ? [
            {
              key,
              uses: match[1] === undefined ? undefined : Number(match[1]),
              each: match[2] === "e",
              spells,
            },
          ]
        : [];
    }),
  );
  const levels = Object.entries(isObject(block.spells) ? block.spells : {}).flatMap(
    ([level, at]) =>
      /^\d$/.test(level) && isObject(at) && Array.isArray(at.spells)
        ? [
            {
              level: Number(level),
              slots: finite(at.slots) ? at.slots : undefined,
              spells: at.spells,
              stored: at,
            },
          ]
        : [],
  );
  return {
    name: typeof block.name === "string" ? block.name : "",
    ability: typeof block.ability === "string" ? block.ability : "",
    displayAs: typeof block.displayAs === "string" ? block.displayAs : "trait",
    header: paragraphsOf(block.headerEntries),
    footer: paragraphsOf(block.footerEntries),
    will: array(block.will),
    ritual: array(block.ritual),
    frequencies,
    levels,
  };
}

const isString = (value: unknown) => typeof value === "string";

/**
 * `record` with `key` set to `value`, or dropped where `value` is `undefined`; a stored value
 * the form could not read, as `reads` says, stays.
 */
function set(
  record: Record<string, unknown>,
  key: string,
  value: unknown,
  reads: (stored: unknown) => boolean,
) {
  if (record[key] !== undefined && !reads(record[key])) return;
  if (value === undefined) delete record[key];
  else record[key] = value;
}

/** Entries the form cannot read from a keyed list, kept beside the ones it rewrites. */
const unread = (value: unknown, readable: (key: string, at: unknown) => boolean) =>
  Object.fromEntries(
    Object.entries(isObject(value) ? value : {}).filter(([key, at]) => !readable(key, at)),
  );

const keyed = (written: Record<string, unknown>) =>
  Object.keys(written).length > 0 ? written : undefined;

const readableUses = (uses: string, at: unknown) => USES.test(uses) && Array.isArray(at);

const readableLevel = (level: string, at: unknown) =>
  /^\d$/.test(level) && isObject(at) && Array.isArray(at.spells);

/** The `key` frequency `rows` state, beside any count the form cannot read; `undefined` where empty. */
function writeFrequency(stored: unknown, key: SpellFrequencyKey, rows: SpellFrequency[]) {
  const written: Record<string, unknown[]> = {};
  for (const { key: at, uses, each, spells } of rows) {
    if (at !== key || spells.length === 0) continue;
    const count = `${uses ?? ""}${each ? "e" : ""}`;
    written[count] = [...(written[count] ?? []), ...spells];
  }
  return keyed({ ...unread(stored, readableUses), ...written });
}

/** The `spells` `rows` state, in level order, beside any level the form cannot read. */
function writeLevels(stored: unknown, rows: SpellLevel[]) {
  const levels: Record<string, Record<string, unknown>> = {};
  for (const { level, slots, spells, stored: at } of [...rows].sort((a, b) => a.level - b.level)) {
    if (spells.length === 0) continue;
    const earlier = levels[level];
    const { slots: _slots, spells: _spells, lower, ...rest } = earlier ?? at;
    const count = slots ?? earlier?.slots;
    levels[level] = {
      ...rest,
      ...(finite(lower) && lower < level ? { lower } : {}),
      ...(level > 0 && count !== undefined ? { slots: count } : {}),
      spells: [...array(earlier?.spells), ...spells],
    };
  }
  return keyed({ ...unread(stored, readableLevel), ...levels });
}

/**
 * `block` with `form` written over it, keeping every field the form does not edit or could
 * not read. A frequency or level with no spells writes nothing; two rows with the same key
 * write their spells together. A trait is upstream's default, so it is not written, and a
 * level's `lower` that is not below it is dropped.
 */
export function writeSpellcasting(
  block: Record<string, unknown>,
  form: SpellcastingForm,
): Record<string, unknown> {
  const next = { ...block };
  set(next, "name", form.name.trim() || undefined, isString);
  set(next, "ability", form.ability || undefined, isString);
  set(next, "displayAs", form.displayAs === "trait" ? undefined : form.displayAs, isString);
  const always = () => true;
  if (form.header !== undefined) set(next, "headerEntries", entriesOf(form.header), always);
  if (form.footer !== undefined) set(next, "footerEntries", entriesOf(form.footer), always);
  set(next, "will", form.will.length > 0 ? form.will : undefined, Array.isArray);
  set(next, "ritual", form.ritual.length > 0 ? form.ritual : undefined, Array.isArray);
  for (const key of FREQUENCY_KEYS)
    set(next, key, writeFrequency(block[key], key, form.frequencies), isObject);
  set(next, "spells", writeLevels(block.spells, form.levels), isObject);
  return next;
}

/** True where `block` holds a field, frequency or level the form neither shows nor changes. */
export function holdsUnread(block: Record<string, unknown>): boolean {
  const unreadable: [string, (stored: unknown) => boolean][] = [
    ["name", isString],
    ["ability", isString],
    ["displayAs", isString],
    ["will", Array.isArray],
    ["ritual", Array.isArray],
    ...FREQUENCY_KEYS.map((key): [string, (stored: unknown) => boolean] => [key, isObject]),
    ["spells", isObject],
  ];
  return (
    unreadable.some(([key, reads]) => block[key] !== undefined && !reads(block[key])) ||
    FREQUENCY_KEYS.some((key) => Object.keys(unread(block[key], readableUses)).length > 0) ||
    Object.keys(unread(block.spells, readableLevel)).length > 0
  );
}

/** The `{@spell}` tag that cites a picked spell, its source always named. */
export const spellTag = (name: string, source: string): string =>
  `{@spell ${name.toLowerCase()}|${source}}`;
