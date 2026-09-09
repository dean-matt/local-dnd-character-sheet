/**
 * `data/class/class-*.json` into the Tier A class tables.
 *
 * Eight tables come from one file: the class and subclass entries, their
 * level-indexed table groups split into spell slots and every other resource,
 * and the features each grants.
 * Slots are the columns of a `rowsSpellProgression`, or — for pact magic — a
 * `Spell Slots` and `Slot Level` column pair; anything else is a resource.
 *
 * A resource value is stored as the text upstream displays, because a column
 * holds "+2 ft." and "1d6" as often as it holds a count. A level a resource has
 * not reached yet stores no row rather than a zero, matching the slot tables,
 * so an absent row means none.
 */
import { parseTags, renderText } from "@dnd/tags";
import { EDITION_FILES, type Edition, editionOf, editions, ownFiles } from "./edition.ts";
import type { Loader, Row } from "./index.ts";
import { type Entry, isRecord, text } from "./json.ts";

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

const PACT_SLOTS = "Spell Slots";
const PACT_SLOT_LEVEL = "Slot Level";

/** Keys identifying the owner of a table group — a class, or a class and subclass. */
type Owner = Record<string, string>;

/** Every class but the three sidekicks carries `hd`, and none rolls more than one. */
function hitDie(entry: Entry, context: string): number {
  const hd = entry.hd;
  if (!isRecord(hd)) throw new Error(`${context}: hd is missing or not an object`);
  const { number, faces } = hd;
  if (number !== 1) {
    throw new Error(`${context}: hd rolls ${String(number)} dice, and hit_die holds one`);
  }
  if (typeof faces !== "number" || !Number.isInteger(faces) || faces < 1) {
    throw new Error(`${context}: hd faces ${String(faces)} is not a positive whole number`);
  }
  return faces;
}

function display(raw: unknown, context: string): string {
  if (typeof raw !== "string") {
    throw new Error(`${context}: column label ${JSON.stringify(raw)} is not a string`);
  }
  const label = renderText(parseTags(raw)).trim();
  if (label === "") throw new Error(`${context}: column label ${raw} renders as nothing`);
  return label;
}

function resourceKey(label: string): string {
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

/** A monk's level 1 movement is a bonus of zero, which is no bonus at all. */
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
  if (rows.length !== 20) {
    throw new Error(`${context}: ${rows.length} rows, and a table covers all 20 levels`);
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

function tableGroups(groups: unknown, owner: Owner, context: string): GroupRows {
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

/**
 * A subclass table group repeats its owner in a `subclasses` list. Trusting the
 * owning entry instead would silently file another subclass's dice under this
 * one, so a group that names anything else is refused rather than guessed at.
 */
function ownsGroups(entry: Entry, name: string, source: string, context: string): void {
  for (const group of Array.isArray(entry.subclassTableGroups) ? entry.subclassTableGroups : []) {
    const listed = isRecord(group) && Array.isArray(group.subclasses) ? group.subclasses : [];
    const mine =
      listed.length === 1 &&
      isRecord(listed[0]) &&
      listed[0].name === name &&
      listed[0].source === source;
    if (!mine) {
      throw new Error(`${context}: a table group names ${JSON.stringify(listed)}, not its owner`);
    }
  }
}

function entriesOf(source: unknown, key: string, path: string): Entry[] {
  if (!isRecord(source)) throw new Error(`${path} is not an object`);
  const entries = source[key];
  if (entries === undefined) return [];
  if (!Array.isArray(entries)) throw new Error(`${path} carries a ${key} that is not a list`);
  return entries.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`${path} ${key}[${index}] is not an object`);
    return entry;
  });
}

function featureLevel(entry: Entry, context: string): number {
  const { level } = entry;
  if (typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > 20) {
    throw new Error(`${context}: level ${String(level)} is not a whole number from 1 to 20`);
  }
  return level;
}

/**
 * A feature's identity is longer than any other Tier A row's, and is the same
 * set of parts its tag carries. `Ability Score Improvement` from `PHB` is 63
 * rows across twelve classes and five levels, so a key of name and source alone
 * resolves 62 of them to the wrong feature and reports nothing wrong.
 */
function classFeatureRow(
  entry: Entry,
  context: string,
  fromSource: (source: string) => Edition,
): Row {
  const source = text(entry, "source", context);
  return {
    name: text(entry, "name", context),
    source,
    class_name: text(entry, "className", context),
    class_source: text(entry, "classSource", context),
    level: featureLevel(entry, context),
    edition: editionOf(entry, source, fromSource),
    json: JSON.stringify(entry),
  };
}

function subclassFeatureRow(
  entry: Entry,
  context: string,
  fromSource: (source: string) => Edition,
): Row {
  return {
    ...classFeatureRow(entry, context, fromSource),
    subclass_short_name: text(entry, "subclassShortName", context),
    subclass_source: text(entry, "subclassSource", context),
  };
}

type Tables = {
  classes: Row[];
  subclasses: Row[];
  class_resources: Row[];
  spell_slots: Row[];
  subclass_resources: Row[];
  subclass_spell_slots: Row[];
  class_features: Row[];
  subclass_features: Row[];
};

type FromSource = (source: string) => Edition;

function addClasses(out: Tables, source: unknown, path: string, fromSource: FromSource): void {
  for (const [index, entry] of entriesOf(source, "class", path).entries()) {
    // The three sidekicks are stat-block companions rather than player classes:
    // they carry no hit die, proficiencies or table groups, which is upstream
    // saying the same thing three ways.
    if (entry.isSidekick === true) continue;
    const context = `${path} class[${index}]`;
    if (entry.subclassTableGroups !== undefined) {
      throw new Error(`${context}: a class entry carries subclassTableGroups`);
    }
    const name = text(entry, "name", context);
    const classSource = text(entry, "source", context);
    out.classes.push({
      name,
      source: classSource,
      edition: editionOf(entry, classSource, fromSource),
      hit_die: hitDie(entry, context),
      json: JSON.stringify(entry),
    });
    const owner = { class_name: name, class_source: classSource };
    const { resources, slots } = tableGroups(entry.classTableGroups, owner, context);
    out.class_resources.push(...resources);
    out.spell_slots.push(...slots);
  }
}

function addSubclasses(out: Tables, source: unknown, path: string, fromSource: FromSource): void {
  for (const [index, entry] of entriesOf(source, "subclass", path).entries()) {
    const context = `${path} subclass[${index}]`;
    const name = text(entry, "name", context);
    const subclassSource = text(entry, "source", context);
    const owner = {
      class_name: text(entry, "className", context),
      class_source: text(entry, "classSource", context),
      subclass_name: name,
      subclass_source: subclassSource,
    };
    ownsGroups(entry, name, subclassSource, context);
    out.subclasses.push({
      name,
      source: subclassSource,
      short_name: text(entry, "shortName", context),
      class_name: owner.class_name,
      class_source: owner.class_source,
      edition: editionOf(entry, subclassSource, fromSource),
      json: JSON.stringify(entry),
    });
    const { resources, slots } = tableGroups(entry.subclassTableGroups, owner, context);
    out.subclass_resources.push(...resources);
    out.subclass_spell_slots.push(...slots);
  }
}

/**
 * A sidekick's class is skipped, so its 47 features are skipped too rather than
 * left naming a class no row holds.
 */
function addFeatures(
  out: Tables,
  claims: Map<Row, string>,
  source: unknown,
  path: string,
  fromSource: FromSource,
  sidekicks: Set<string>,
): void {
  const keep = (row: Row, into: Row[], context: string) => {
    if (sidekicks.has(classKey(row))) return;
    into.push(row);
    claims.set(row, context);
  };
  for (const [index, entry] of entriesOf(source, "classFeature", path).entries()) {
    const context = `${path} classFeature[${index}]`;
    keep(classFeatureRow(entry, context, fromSource), out.class_features, context);
  }
  for (const [index, entry] of entriesOf(source, "subclassFeature", path).entries()) {
    const context = `${path} subclassFeature[${index}]`;
    keep(subclassFeatureRow(entry, context, fromSource), out.subclass_features, context);
  }
}

/** The class a row names, as the key the class and feature tables agree on. */
function classKey(row: Row): string {
  return `${String(row.class_name)}|${String(row.class_source)}`;
}

/**
 * A feature naming a class no row holds loads fine and is then invisible: every
 * query for that class comes back without it. The sidekick skip is one known
 * case, so the rest are refused rather than assumed absent.
 *
 * Runs once every file is read, since a feature need not arrive with its class,
 * which is why the entry it came from is carried here rather than named again.
 */
function checkFeatureOwners(out: Tables, claims: Map<Row, string>): void {
  const known = new Set(out.classes.map((row) => `${String(row.name)}|${String(row.source)}`));
  for (const [row, context] of claims) {
    if (!known.has(classKey(row))) {
      throw new Error(
        `${context}: ${String(row.name)} names class ${classKey(row)}, which no row holds`,
      );
    }
  }
}

/** Read before any row is built: a feature need not share a file with its class. */
function sidekickClasses(files: [string, unknown][]): Set<string> {
  const sidekicks = new Set<string>();
  for (const [path, source] of files) {
    for (const [index, entry] of entriesOf(source, "class", path).entries()) {
      if (entry.isSidekick !== true) continue;
      const context = `${path} class[${index}]`;
      sidekicks.add(`${text(entry, "name", context)}|${text(entry, "source", context)}`);
    }
  }
  return sidekicks;
}

export const classes: Loader = {
  name: "classes",
  files: ["data/class/class-*.json", ...EDITION_FILES],
  rows: (sources) => {
    const fromSource = editions(sources);
    const out: Tables = {
      classes: [],
      subclasses: [],
      class_resources: [],
      spell_slots: [],
      subclass_resources: [],
      subclass_spell_slots: [],
      class_features: [],
      subclass_features: [],
    };

    const files = ownFiles(sources);
    const sidekicks = sidekickClasses(files);
    const claims = new Map<Row, string>();
    for (const [path, source] of files) {
      addClasses(out, source, path, fromSource);
      addSubclasses(out, source, path, fromSource);
      addFeatures(out, claims, source, path, fromSource, sidekicks);
    }
    checkFeatureOwners(out, claims);
    return out;
  },
};
