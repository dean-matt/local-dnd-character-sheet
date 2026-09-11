/**
 * The `_mod` modes that read a creature rather than a property.
 *
 * Every other mode splices a list or rewrites text and needs to know nothing
 * about what it is editing. These four do: a skill bonus is arithmetic over the
 * creature's own ability scores and challenge rating, and a spell sits three
 * levels inside a `spellcasting` block under a key naming how often it recharges.
 * They arrive under the `_` property, which is upstream saying the operation
 * takes the whole entry.
 */
import { abilityModifier } from "@dnd/rules";
import { type Entry, isRecord } from "./json.ts";

/** The ability a skill is rolled with. Upstream keys a skill lowercase and unspaced. */
const SKILL_ABILITY: Record<string, string> = {
  athletics: "str",
  acrobatics: "dex",
  sleight: "dex",
  "sleight of hand": "dex",
  stealth: "dex",
  arcana: "int",
  history: "int",
  investigation: "int",
  nature: "int",
  religion: "int",
  "animal handling": "wis",
  insight: "wis",
  medicine: "wis",
  perception: "wis",
  survival: "wis",
  deception: "cha",
  intimidation: "cha",
  performance: "cha",
  persuasion: "cha",
};

/**
 * A creature's challenge rating as a number. Upstream writes it as a string, a
 * fraction below 1, and an object when a lair changes it — `{cr: "5", lair: "6"}`,
 * where the plain rating is the one a proficiency bonus comes from.
 */
function challengeRating(entry: Entry, context: string): number {
  const declared = isRecord(entry.cr) ? entry.cr.cr : entry.cr;
  if (typeof declared === "number") return declared;
  if (typeof declared !== "string") {
    throw new Error(`${context}: needs a challenge rating, found ${typeof declared}`);
  }
  const [numerator, denominator] = declared.split("/");
  const value = Number(numerator) / Number(denominator ?? 1);
  if (!Number.isFinite(value)) {
    throw new Error(`${context}: challenge rating ${JSON.stringify(declared)} is not a number`);
  }
  return value;
}

/**
 * Not `proficiencyBonus` from `@dnd/rules`, which takes a character level and
 * refuses anything outside 1-20. The curve is the same, but a creature's input is
 * its challenge rating, and ratings run from 0 to 30: everything below 1 shares
 * the bonus of a rating of 1.
 */
function creatureProficiencyBonus(entry: Entry, context: string): number {
  return 2 + Math.floor((Math.max(challengeRating(entry, context), 1) - 1) / 4);
}

/** A bonus as a stat block prints it, which is signed even when it is zero. */
const signed = (value: number): string => (value < 0 ? String(value) : `+${value}`);

/**
 * Adds a skill at a proficiency multiplier — 1 for proficient, 2 for expertise —
 * computing the bonus the way the printed stat block does, since upstream states
 * the multiplier and never the total. A creature with no `skill` block gets one.
 */
export function addSkills(entry: Entry, op: Entry, context: string): void {
  if (!isRecord(op.skills)) throw new Error(`${context}: addSkills needs a skills object`);
  const bonus = creatureProficiencyBonus(entry, context);
  const skills: Entry = isRecord(entry.skill) ? { ...entry.skill } : {};

  for (const [skill, multiplier] of Object.entries(op.skills)) {
    const ability = SKILL_ABILITY[skill.toLowerCase()];
    if (ability === undefined) throw new Error(`${context}: addSkills does not know "${skill}"`);
    if (typeof multiplier !== "number") {
      throw new Error(`${context}: addSkills needs a number for "${skill}"`);
    }
    const score = entry[ability];
    if (typeof score !== "number") {
      throw new Error(
        `${context}: addSkills reads ${ability} for "${skill}", which is not a score`,
      );
    }
    skills[skill] = signed(abilityModifier(score) + bonus * multiplier);
  }
  entry.skill = skills;
}

/** One list of spells inside a `spellcasting` block, with the items the op aims at it. */
type Target = {
  where: string;
  items: unknown[];
  list: unknown[];
  write: (next: unknown[]) => void;
};

/** The recharge keys whose value is a map of frequency to a list — `daily: {"1e": [...]}`. */
const BY_FREQUENCY = ["daily", "rest", "weekly", "yearly", "charges"];

function child(parent: Entry, key: string, context: string): Entry {
  const existing = parent[key];
  if (existing !== undefined && !isRecord(existing)) {
    throw new Error(`${context}: ${key} is not an object`);
  }
  const next = isRecord(existing) ? existing : {};
  parent[key] = next;
  return next;
}

function list(holder: Entry, key: string, context: string): unknown[] {
  const existing = holder[key];
  if (existing !== undefined && !Array.isArray(existing)) {
    throw new Error(`${context}: ${key} is not a list of spells`);
  }
  return Array.isArray(existing) ? [...existing] : [];
}

/**
 * The one `spellcasting` block the op edits. Every entry in the corpus that
 * carries one of these modes has exactly one, and choosing among several is a
 * guess — so a second block refuses rather than picking the first.
 */
function onlyBlock(entry: Entry, mode: string, context: string): Entry {
  const blocks = Array.isArray(entry.spellcasting) ? entry.spellcasting.filter(isRecord) : [];
  const only = blocks[0];
  if (blocks.length !== 1 || only === undefined) {
    throw new Error(`${context}: ${mode} needs one spellcasting block, found ${blocks.length}`);
  }
  return only;
}

/** One list and the items aimed at it, wherever in the block that list sits. */
function listTarget(
  holder: Entry,
  key: string,
  items: unknown,
  where: string,
  context: string,
): Target {
  return {
    where,
    items: Array.isArray(items) ? items : [items],
    list: list(holder, key, context),
    write: (next) => (holder[key] = next),
  };
}

/**
 * A key whose value is a map: one list per frequency for the recharge keys, and
 * for `spells` one per spell level, sitting beside that level's slot count —
 * which is why it descends one further and `will` above does not.
 */
function groupTargets(
  block: Entry,
  key: string,
  value: unknown,
  mode: string,
  context: string,
): Target[] {
  if (!isRecord(value)) throw new Error(`${context}: ${mode}.${key} is not an object`);
  const nested = key === "spells";
  const group = child(block, key, context);
  return Object.entries(value).map(([at, items]) => {
    const holder = nested ? child(group, at, context) : group;
    const declared = nested && isRecord(items) ? items.spells : items;
    return listTarget(holder, nested ? "spells" : at, declared, `${key}.${at}`, context);
  });
}

/** Where in the block each part of the op lands. */
function targets(block: Entry, op: Entry, mode: string, context: string): Target[] {
  const found: Target[] = [];
  for (const [key, value] of Object.entries(op)) {
    if (key === "mode") continue;
    if (key === "will") {
      found.push(listTarget(block, key, value, key, context));
      continue;
    }
    if (!BY_FREQUENCY.includes(key) && key !== "spells") {
      throw new Error(`${context}: ${mode} does not know "${key}"`);
    }
    found.push(...groupTargets(block, key, value, mode, context));
  }
  return found;
}

function replaceOne(target: Target, swap: unknown, mode: string, context: string): unknown[] {
  if (!isRecord(swap) || typeof swap.replace !== "string") {
    throw new Error(`${context}: ${mode} needs a "replace" naming the spell to swap out`);
  }
  const at = target.list.indexOf(swap.replace);
  if (at === -1) {
    throw new Error(`${context}: ${mode} found no ${swap.replace} in ${target.where}`);
  }
  return target.list.with(at, swap.with);
}

function removeFrom(target: Target, mode: string, context: string): unknown[] {
  const going = new Set(target.items);
  const absent = target.items.filter((spell) => !target.list.includes(spell));
  if (absent.length > 0) {
    throw new Error(
      `${context}: ${mode} names ${absent.map((s) => String(s)).join(", ")}, which ${target.where} does not hold`,
    );
  }
  return target.list.filter((spell) => !going.has(spell));
}

/**
 * Adds, swaps or drops spells inside the creature's `spellcasting` block. A
 * replacement or a removal naming a spell the list does not hold is refused, for
 * the reason `replaceArr` and `removeArr` refuse the same: a typo that silently
 * does nothing reads as a working mod.
 */
export function modifySpells(entry: Entry, op: Entry, mode: string, context: string): void {
  const block = onlyBlock(entry, mode, context);
  for (const target of targets(block, op, mode, context)) {
    if (mode === "addSpells") {
      target.write([...target.list, ...target.items]);
      continue;
    }
    if (mode === "removeSpells") {
      target.write(removeFrom(target, mode, context));
      continue;
    }
    let next = target.list;
    for (const swap of target.items)
      next = replaceOne({ ...target, list: next }, swap, mode, context);
    target.write(next);
  }
}
