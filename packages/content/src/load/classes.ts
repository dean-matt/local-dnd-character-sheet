/**
 * `data/class/class-*.json` into the Tier A class tables.
 *
 * Ten tables come from one file: the class and subclass entries, their
 * level-indexed table groups split into spell slots and every other resource,
 * the optional features each level may pick, and the features each grants.
 * Slots are the columns of a `rowsSpellProgression`, or — for pact magic — a
 * `Spell Slots` and `Slot Level` column pair; anything else is a resource.
 *
 * A resource value is stored as the text upstream displays, because a column
 * holds "+2 ft." and "1d6" as often as it holds a count. A level a resource has
 * not reached yet stores no row rather than a zero, matching the slot tables,
 * so an absent row means none.
 */
import { parseTags, renderText } from "@dnd/tags";
import { featureTypePool, OPTIONAL_FEATURES_FILE, poolKey } from "./character-options.ts";
import { EDITION_FILES, type Edition, editionOf, editions, ownFiles } from "./edition.ts";
import type { Loader, Row } from "./index.ts";
import { type Entry, isRecord, strings, text } from "./json.ts";

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
const LEVELS = 20;

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

function optionCount(cell: unknown, context: string): number {
  if (typeof cell !== "number" || !Number.isInteger(cell) || cell < 0) {
    throw new Error(`${context}: ${JSON.stringify(cell)} is not a count of options`);
  }
  return cell;
}

function stated(cells: unknown[], context: string): number[] {
  if (cells.length !== LEVELS) {
    throw new Error(
      `${context}: ${cells.length} cells, and a progression covers all ${LEVELS} levels`,
    );
  }
  return cells.map((cell, index) => optionCount(cell, `${context} level ${index + 1}`));
}

/**
 * A `progression` keyed by the levels the count changes at, which says nothing
 * about the levels between: a sorcerer's `{"3":2,"10":3,"17":4}` knows two kinds
 * of metamagic at level 9, not none. Read as though it were stated, it files
 * every count at three levels and loses the other 15.
 */
function carried(progression: Entry, context: string): number[] {
  const changes = new Map<number, number>();
  for (const [key, cell] of Object.entries(progression)) {
    // Four feats and one optional feature key a progression `*`, for "at any
    // level", since neither has one. No class or subclass entry does, and these
    // tables are keyed by level, so it is named rather than read as a number.
    if (key === "*") {
      throw new Error(`${context}: a progression keyed "*" has no level to file a count at`);
    }
    // Exactly the 20 spellings, so no two keys reach one level and overwrite it:
    // Number would take "03", " 3" and "1e1" and land all three on a level.
    const level = /^(?:[1-9]|1\d|20)$/.test(key) ? Number(key) : Number.NaN;
    if (!Number.isInteger(level) || level < 1 || level > LEVELS) {
      throw new Error(`${context}: ${JSON.stringify(key)} is not a level from 1 to ${LEVELS}`);
    }
    changes.set(level, optionCount(cell, `${context} level ${level}`));
  }
  const counts: number[] = [];
  let held = 0;
  for (let level = 1; level <= LEVELS; level += 1) {
    held = changes.get(level) ?? held;
    counts.push(held);
  }
  return counts;
}

function progression(raw: unknown, context: string): number[] {
  if (Array.isArray(raw)) return stated(raw, context);
  if (isRecord(raw)) return carried(raw, context);
  throw new Error(`${context}: progression is neither a list of levels nor a map of them`);
}

/**
 * One block's rows: a level each, and a type each where a block names several.
 *
 * A block entitling no level to anything is upstream writing a progression and
 * saying nothing with it. Stored, it is a block that silently vanishes, so it is
 * refused the way a feature naming no class is.
 */
function blockRows(block: Entry, owner: Owner, where: string): Row[] {
  const counts = progression(block.progression, where);
  if (!counts.some((known) => known > 0)) {
    throw new Error(`${where}: a progression no level may pick from`);
  }
  const types = strings(block, "featureType", where);
  const [type] = types;
  if (types.length !== 1 || type === undefined) {
    throw new Error(
      `${where}: ${types.length} feature types share one count, and a row holds a count per type`,
    );
  }
  const rows: Row[] = [];
  for (const [at, known] of counts.entries()) {
    if (known > 0) rows.push({ ...owner, level: at + 1, feature_type: type, known });
  }
  return rows;
}

/**
 * Two blocks of one entry offering the same type collide on the primary key,
 * which reaches the build as a bare UNIQUE constraint naming neither the class
 * nor the type. They are also two counts that were meant to add up, and one row
 * holds one, so the refusal says that rather than the column that noticed.
 */
function oneCountEach(rows: Row[], context: string): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${String(row.feature_type)}|${String(row.level)}`;
    if (seen.has(key)) {
      throw new Error(
        `${context}: two progressions offer ${String(row.feature_type)} at level ${String(row.level)}, and one row holds one count`,
      );
    }
    seen.add(key);
  }
}

/**
 * `optionalfeatureProgression` into a row per level that may pick.
 *
 * A count absent from the sparse form is carried forward here rather than at
 * query time, so both forms leave the same rows and a reader needs neither.
 */
function optionalFeatures(blocks: unknown, owner: Owner, context: string): Row[] {
  if (blocks === undefined) return [];
  if (!Array.isArray(blocks)) {
    throw new Error(`${context}: optionalfeatureProgression is not a list`);
  }
  const rows = blocks.flatMap((block, index) => {
    const where = `${context} optionalfeatureProgression[${index}]`;
    if (!isRecord(block)) throw new Error(`${where} is not an object`);
    return blockRows(block, owner, where);
  });
  oneCountEach(rows, context);
  return rows;
}

/** The type code a counted column names, ahead of anything else the tag carries. */
const FEATURE_TYPE = /\|feature type=([^|}]+)/;

/** Every one of the 13 `featureType` codes in the corpus is this shape. */
const PLAIN_CODE = /^[A-Z0-9:]+$/;

/**
 * A filter value is a small grammar: 265 tags in the corpus list values with `;`
 * or negate one with `!`, and it also brackets groups and pads with spaces. None
 * of that sits on a `feature type=` yet, and a column counting two types is a
 * count a row cannot divide, so anything but one plain code is refused by shape
 * rather than by listing the forms to reject. Matching the shape is what keeps
 * the refusal honest: a value this cannot read would otherwise fold to a bogus
 * code and be reported as a progression that does not offer it, sending a reader
 * to the wrong file.
 */
function plainCode(value: string, context: string): string {
  const code = value.toUpperCase();
  if (!PLAIN_CODE.test(code)) {
    throw new Error(
      `${context}: a column filters feature type ${JSON.stringify(value)}, and this reads one plain code`,
    );
  }
  return code;
}

/**
 * The columns that state a count `optionalfeatureProgression` states again, as
 * the code the column names paired with the key its label resolves to. The code
 * is in the tag `display` renders away, so pairing the two needs no hand-kept
 * map from type code to resource key — the list `edition.ts` warns goes stale
 * the day upstream ships a book.
 */
function countedColumns(groups: unknown, context: string): { code: string; key: string }[] {
  const labels = (Array.isArray(groups) ? groups : [])
    .filter(isRecord)
    .flatMap((group) => (Array.isArray(group.colLabels) ? group.colLabels : []));
  return labels.flatMap((raw: unknown) => {
    const code = typeof raw === "string" ? FEATURE_TYPE.exec(raw)?.[1] : undefined;
    if (code === undefined) return [];
    return [{ code: plainCode(code, context), key: resourceKey(display(raw, context)) }];
  });
}

/**
 * Refuses where the two tables holding one count disagree. They agree across the
 * corpus and nothing made them, so a newer tag that edits the column and not the
 * progression would ship a sheet printing a count the picker does not offer —
 * two well formed rows, and no query that reports the difference.
 *
 * A column counting a type the entry never offers is refused rather than passed
 * over: a skip is how this check would stop running without saying so.
 *
 * The pairing is entry-local, which is the ceiling: a class states the column and
 * a class states the progression, in all three pairs the corpus has. The two do
 * split across entries already — `Fighter|XPHB` carries no progression while
 * `Battle Master|XPHB` carries `MV:B` — so a tag that put a maneuver column on
 * the fighter's own table would be refused here rather than resolved against the
 * subclass. The way out is to collect the counted columns and the progressions
 * across an entry and its subclasses first and pair them after, as
 * `checkFeatureOwners` does for features; it is not worth the pass until a column
 * and its progression actually land on different entries.
 */
function countsAgree(resources: Row[], typed: Row[], groups: unknown, context: string): void {
  const counted = countedColumns(groups, context);
  for (const { code, key } of counted) {
    const offered = typed.filter((row) => row.feature_type === code);
    if (offered.length === 0) {
      throw new Error(
        `${context}: a column counts ${code}, which no optionalfeatureProgression offers`,
      );
    }
    const known = new Map(offered.map((row) => [row.level, String(row.known)]));
    const printed = new Map(
      resources
        .filter((row) => row.resource_key === key)
        .map((row) => [row.level, String(row.value)]),
    );
    for (let level = 1; level <= LEVELS; level += 1) {
      const column = printed.get(level) ?? "0";
      const offers = known.get(level) ?? "0";
      if (column !== offers) {
        throw new Error(
          `${context} level ${level}: the ${key} column counts ${column} and ${code} offers ${offers}`,
        );
      }
    }
  }
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
  class_optional_features: Row[];
  subclass_optional_features: Row[];
  class_features: Row[];
  subclass_features: Row[];
};

type FromSource = (source: string) => Edition;

function addClasses(
  out: Tables,
  source: unknown,
  path: string,
  fromSource: FromSource,
  pool: Set<string>,
): void {
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
    const edition = editionOf(entry, classSource, fromSource);
    out.classes.push({
      name,
      source: classSource,
      edition,
      hit_die: hitDie(entry, context),
      json: JSON.stringify(entry),
    });
    const owner = { class_name: name, class_source: classSource };
    const { resources, slots } = tableGroups(entry.classTableGroups, owner, context);
    const typed = optionalFeatures(entry.optionalfeatureProgression, owner, context);
    countsAgree(resources, typed, entry.classTableGroups, context);
    typesOffered(typed, `${name}|${classSource}`, edition, pool, context);
    out.class_resources.push(...resources);
    out.spell_slots.push(...slots);
    out.class_optional_features.push(...typed);
  }
}

function addSubclasses(
  out: Tables,
  source: unknown,
  path: string,
  fromSource: FromSource,
  pool: Set<string>,
): void {
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
    const edition = editionOf(entry, subclassSource, fromSource);
    out.subclasses.push({
      name,
      source: subclassSource,
      short_name: text(entry, "shortName", context),
      class_name: owner.class_name,
      class_source: owner.class_source,
      edition,
      json: JSON.stringify(entry),
    });
    const { resources, slots } = tableGroups(entry.subclassTableGroups, owner, context);
    const typed = optionalFeatures(entry.optionalfeatureProgression, owner, context);
    countsAgree(resources, typed, entry.subclassTableGroups, context);
    typesOffered(typed, `${name}|${subclassSource}`, edition, pool, context);
    out.subclass_resources.push(...resources);
    out.subclass_spell_slots.push(...slots);
    out.subclass_optional_features.push(...typed);
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

/**
 * A progression naming a type no optional feature carries entitles the entry to
 * a count over an empty pool: the row says a level 7 warlock picks 6, the join
 * returns 0 options, and both halves are well formed. An upstream rename of a
 * code is all it takes, and nothing else reports it.
 *
 * Edition is half the key because the pick query is edition-scoped — a sheet
 * offers the options of the edition the counting row itself belongs to, which is
 * the subclass's own where a subclass counts — so an entry counting a code only
 * the other edition's features carry has the same empty join. All 15 pairs the
 * corpus states resolve, the thinnest of them by 2 options.
 *
 * The invariant is one-directional. A pool code no progression offers is
 * legitimate — `RP` is Eberron house renown, four options granted by a story
 * award rather than by a class — so only the count side has to resolve.
 *
 * The pool comes from `optionalfeatures.json` itself rather than from the rows
 * `character-options` writes out of it, since a loader cannot see what an
 * earlier one wrote.
 */
function typesOffered(
  typed: Row[],
  who: string,
  edition: Edition,
  pool: Set<string>,
  context: string,
): void {
  for (const row of typed) {
    const type = String(row.feature_type);
    if (pool.has(poolKey(edition, type))) continue;
    // Which edition, spelled out: "no one optional feature" reads as none at
    // all, and sending a reader after an upstream rename is the wrong hunt.
    throw new Error(
      `${context}: ${who} counts ${type}, which no optional feature of the ${edition} edition carries`,
    );
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
  files: ["data/class/class-*.json", OPTIONAL_FEATURES_FILE, ...EDITION_FILES],
  rows: (sources) => {
    const fromSource = editions(sources);
    const out: Tables = {
      classes: [],
      subclasses: [],
      class_resources: [],
      spell_slots: [],
      subclass_resources: [],
      subclass_spell_slots: [],
      class_optional_features: [],
      subclass_optional_features: [],
      class_features: [],
      subclass_features: [],
    };

    const files = ownFiles(sources).filter(([path]) => path !== OPTIONAL_FEATURES_FILE);
    const sidekicks = sidekickClasses(files);
    const pool = featureTypePool(sources, fromSource);
    const claims = new Map<Row, string>();
    for (const [path, source] of files) {
      addClasses(out, source, path, fromSource, pool);
      addSubclasses(out, source, path, fromSource, pool);
      addFeatures(out, claims, source, path, fromSource, sidekicks);
    }
    checkFeatureOwners(out, claims);
    return out;
  },
};
