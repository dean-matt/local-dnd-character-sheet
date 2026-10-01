/**
 * A class or subclass entry's level-indexed table groups, split into spell
 * slots and every other resource. Slots are the columns of a
 * `rowsSpellProgression`, or — for pact magic — a `Spell Slots` and
 * `Slot Level` column pair; anything else is a resource.
 *
 * A resource value is stored as the text upstream displays, because a column
 * holds "+2 ft." and "1d6" as often as it holds a count. A level a resource has
 * not reached yet stores no row rather than a zero, matching the slot tables,
 * so an absent row means none.
 */
import { parseTags, renderText } from "@dnd/tags";
import type { Row } from "./index.ts";
import { type Entry, isRecord } from "./json.ts";

/**
 * Every column label the corpus carries, pinned to a key rather than slugged
 * from the label, because `resource_key` is what a character's counters
 * reference: an upstream rewording would otherwise orphan them silently. Of the
 * 33 labels, 21 are plain prose and 12 arrive as `{@filter}` or `{@tip}` markup
 * reduced to its display text — a slug from prose is exactly what a pin avoids.
 *
 * Where an edition renamed a column without changing what it counts, both names
 * pin to one key, so switching a character's edition keeps its counter. `Spells
 * Known` and `Prepared Spells` stay apart: 2024 changed the mechanic, not the
 * wording. The two labels missing here are the pact magic pair, which becomes
 * spell slots instead.
 *
 * A label absent from this map is still stored, keyed by its slug, so a column
 * upstream adds arrives as a generic counter rather than as nothing.
 */
const RESOURCE_KEYS: Record<string, string> = {
  Rages: "rages",
  "Rage Damage": "rage_damage",
  "Ki Points": "ki_points",
  "Focus Points": "focus_points",
  "Sorcery Points": "sorcery_points",
  "Channel Divinity": "channel_divinity",
  "Martial Arts": "martial_arts",
  "Bardic Die": "bardic_die",
  "Second Wind": "second_wind",
  "Sneak Attack": "sneak_attack",
  "Wild Shape": "wild_shape",
  "Weapon Mastery": "weapon_mastery",
  "Unarmored Movement": "unarmored_movement",
  "Infused Items": "infused_items",
  "Infusions Known": "infusions_known",
  "Favored Enemy": "favored_enemy",
  "Psi Points": "psi_points",
  "Psi Limit": "psi_limit",
  "Plans Known": "plans_known",
  "Magic Items": "magic_items",
  "Talents Known": "talents_known",
  "Disciplines Known": "disciplines_known",
  "Cantrips Known": "cantrips_known",
  Cantrips: "cantrips_known",
  "Spells Known": "spells_known",
  "Prepared Spells": "prepared_spells",
  "Spells Prepared": "prepared_spells",
  "Invocations Known": "invocations_known",
  Invocations: "invocations_known",
  // Psi Warrior and Soulknife label these "Die Size" and "Number", and each
  // calls it an energy die in the tip the label links to. The pin is corpus-wide
  // and "Number" is the most generic label here, so a column labelled that on
  // any other table would land on the energy die's key. The way out is a pin
  // scoped to (class, subclass), once a second table wants one of these words.
  "Die Size": "energy_die_size",
  Number: "energy_die_number",
};

/** Every class table and progression in the corpus covers all 20 levels. */
export const LEVELS = 20;

const PACT_SLOTS = "Spell Slots";
const PACT_SLOT_LEVEL = "Slot Level";

/** Keys identifying the owner of a table group — a class, or a class and subclass. */
export type Owner = Record<string, string>;

export function display(raw: unknown, context: string): string {
  if (typeof raw !== "string") {
    throw new Error(`${context}: column label ${JSON.stringify(raw)} is not a string`);
  }
  const label = renderText(parseTags(raw)).trim();
  if (label === "") throw new Error(`${context}: column label ${raw} renders as nothing`);
  return label;
}

export function resourceKey(label: string): string {
  return (
    RESOURCE_KEYS[label] ??
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  );
}

function dice(cell: Entry, context: string): string {
  const { toRoll } = cell;
  if (!Array.isArray(toRoll) || toRoll.length === 0) {
    throw new Error(`${context}: a dice cell carries no toRoll`);
  }
  return toRoll
    .map((die) => {
      if (!isRecord(die) || typeof die.number !== "number" || typeof die.faces !== "number") {
        throw new Error(`${context}: ${JSON.stringify(die)} is not a die`);
      }
      return `${die.number}d${die.faces}`;
    })
    .join(" + ");
}

/** A monk's level 1 movement is a bonus of zero, no bonus at all. */
function signed(cell: Entry, context: string, unit: string): string | null {
  const { value: bonus } = cell;
  if (typeof bonus !== "number" || !Number.isFinite(bonus)) {
    throw new Error(`${context}: bonus ${JSON.stringify(bonus)} is not a number`);
  }
  if (bonus === 0) return null;
  return `${bonus > 0 ? "+" : ""}${bonus}${unit}`;
}

/** The text to store, or null where the class has no such resource at that level. */
function value(cell: unknown, context: string): string | null {
  if (typeof cell === "number") return cell === 0 ? null : String(cell);
  if (typeof cell === "string") {
    const shown = renderText(parseTags(cell)).trim();
    return shown === "" || shown === "0" || shown === "—" ? null : shown;
  }
  if (isRecord(cell)) {
    if (cell.type === "dice") return dice(cell, context);
    if (cell.type === "bonus") return signed(cell, context, "");
    if (cell.type === "bonusSpeed") return signed(cell, context, " ft.");
  }
  throw new Error(`${context}: ${JSON.stringify(cell)} is not a value this loader reads`);
}

/** Pact magic gives the slot level as a column of its own, as "1st" or as 1. */
function slotLevel(cell: unknown, context: string): number {
  const shown = typeof cell === "number" ? String(cell) : renderText(parseTags(String(cell)));
  const digits = /^\d+/.exec(shown.trim());
  const level = digits ? Number(digits[0]) : Number.NaN;
  if (!Number.isInteger(level) || level < 1 || level > 9) {
    throw new Error(`${context}: ${JSON.stringify(cell)} is not a slot level from 1 to 9`);
  }
  return level;
}

function slotCount(cell: unknown, context: string): number {
  // Number("") is 0, which would read a blank cell as a level granting no slots.
  const written = typeof cell === "number" ? cell : String(cell).trim();
  const count = written === "" ? Number.NaN : Number(written);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`${context}: ${JSON.stringify(cell)} is not a slot count`);
  }
  return count;
}

/**
 * Row n is level n, which holds because every group in the corpus carries all
 * 20 — the Psi Warrior table pads levels 1 and 2 with zeros rather than starting
 * at the level the subclass is gained. A group that started higher would file
 * every row too low and still build, so the count is checked rather than the
 * convention assumed.
 */
function levelled(rows: unknown, context: string): unknown[][] {
  if (!Array.isArray(rows)) throw new Error(`${context}: rows is not a list`);
  if (rows.length !== LEVELS) {
    throw new Error(`${context}: ${rows.length} rows, and a table covers all ${LEVELS} levels`);
  }
  return rows.map((row, index) => {
    if (!Array.isArray(row)) throw new Error(`${context} level ${index + 1}: row is not a list`);
    return row;
  });
}

type GroupRows = { resources: Row[]; slots: Row[] };

type Columns = { labels: string[]; pactSlots: number; pactLevel: number };

function columns(group: Entry, context: string): Columns {
  const labels = (Array.isArray(group.colLabels) ? group.colLabels : []).map((raw) =>
    display(raw, context),
  );
  if (labels.length === 0) throw new Error(`${context}: colLabels is missing or empty`);
  const pactSlots = labels.indexOf(PACT_SLOTS);
  const pactLevel = labels.indexOf(PACT_SLOT_LEVEL);
  if ((pactSlots === -1) !== (pactLevel === -1)) {
    throw new Error(`${context}: "${PACT_SLOTS}" and "${PACT_SLOT_LEVEL}" come as a pair`);
  }
  return { labels, pactSlots, pactLevel };
}

function pactRow(
  row: unknown[],
  cols: Columns,
  owner: Owner,
  level: number,
  where: string,
): Row | null {
  if (cols.pactSlots === -1) return null;
  const count = slotCount(row[cols.pactSlots], where);
  if (count === 0) return null;
  return { ...owner, level, slot_level: slotLevel(row[cols.pactLevel], where), slots: count };
}

/** A group of plain `rows`: the pact columns become slots, the rest resources. */
function fromRows(group: Entry, owner: Owner, context: string): GroupRows {
  const cols = columns(group, context);
  const resources: Row[] = [];
  const slots: Row[] = [];
  for (const [index, row] of levelled(group.rows, context).entries()) {
    const level = index + 1;
    const where = `${context} level ${level}`;
    if (row.length !== cols.labels.length) {
      throw new Error(`${where}: ${row.length} cells for ${cols.labels.length} columns`);
    }
    const pact = pactRow(row, cols, owner, level, where);
    if (pact) slots.push(pact);
    for (const [column, label] of cols.labels.entries()) {
      if (column === cols.pactSlots || column === cols.pactLevel) continue;
      const shown = value(row[column], where);
      if (shown === null) continue;
      resources.push({ ...owner, level, resource_key: resourceKey(label), value: shown });
    }
  }
  return { resources, slots };
}

/**
 * A `rowsSpellProgression` group: column n is slot level n, and holds a count.
 *
 * The columns carry their own labels — `1st` through `9th` — and every group in
 * the corpus starts at `1st`. A group that started anywhere else would file
 * every slot one or more levels too low without failing, so the labels are read
 * rather than assumed.
 */
function fromProgression(group: Entry, owner: Owner, context: string): Row[] {
  const labels = Array.isArray(group.colLabels) ? group.colLabels : [];
  const slots: Row[] = [];
  for (const [index, row] of levelled(group.rowsSpellProgression, context).entries()) {
    const level = index + 1;
    const where = `${context} level ${level}`;
    if (row.length !== labels.length) {
      throw new Error(`${where}: ${row.length} cells for ${labels.length} columns`);
    }
    for (const [column, cell] of row.entries()) {
      const labelled = slotLevel(display(labels[column], context), context);
      if (labelled !== column + 1) {
        throw new Error(`${context}: column ${column + 1} is labelled for slot level ${labelled}`);
      }
      const count = slotCount(cell, where);
      if (count > 0) {
        slots.push({ ...owner, level, slot_level: labelled, slots: count });
      }
    }
  }
  return slots;
}

export function tableGroups(groups: unknown, owner: Owner, context: string): GroupRows {
  if (groups === undefined) return { resources: [], slots: [] };
  if (!Array.isArray(groups)) throw new Error(`${context}: table groups is not a list`);
  const resources: Row[] = [];
  const slots: Row[] = [];
  for (const [index, group] of groups.entries()) {
    const where = `${context} group ${index}`;
    if (!isRecord(group)) throw new Error(`${where} is not an object`);
    if (group.rowsSpellProgression !== undefined && group.rows !== undefined) {
      throw new Error(`${where} carries both rows and rowsSpellProgression`);
    }
    if (group.rowsSpellProgression !== undefined) {
      slots.push(...fromProgression(group, owner, where));
      continue;
    }
    const plain = fromRows(group, owner, where);
    resources.push(...plain.resources);
    slots.push(...plain.slots);
  }
  return { resources, slots };
}
