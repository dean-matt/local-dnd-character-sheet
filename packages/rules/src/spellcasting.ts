/**
 * Spell math: the DCs a caster sets and saves against, and the slots a multiclass
 * caster gets.
 *
 * Caster level and the slot table live together because summing each class's own
 * slots is the mistake the rules exist to prevent, and because spellcasting is the
 * one rules area still growing — single-class slots and pact tables arrive from
 * `content.db`, not from arithmetic.
 *
 * Progression is an argument and never an edition branch, because the editions
 * disagree about it.
 */

import { proficiencyBonus } from "./core.ts";
import type { Edition } from "./edition.ts";
import { assertInteger } from "./integer.ts";

/**
 * Both take the total character level, never a caster level: proficiency comes from
 * the character, so passing `multiclassCasterLevel` here reads as if it works and is
 * wrong by the difference.
 */
export function spellSaveDc(spellcastingModifier: number, characterLevel: number): number {
  return 8 + proficiencyBonus(characterLevel) + spellcastingModifier;
}

export function spellAttackBonus(spellcastingModifier: number, characterLevel: number): number {
  return proficiencyBonus(characterLevel) + spellcastingModifier;
}

/**
 * The cap the 2024 rule adds and the 2014 rule lacks: PHB p.203 stops at "whichever
 * number is higher", where XPHB p.363 adds "up to a maximum DC of 30". That clause is
 * the only disagreement, and the only reason this takes an edition.
 */
const CONCENTRATION_DC_CAP_ONE = 30;

/**
 * The Constitution save DC to keep concentration after taking damage: 10, or half the
 * damage rounded down, whichever is higher.
 *
 * One source of damage per call: PHB p.203 says an arrow and a dragon's breath each
 * take their own save, and summing them first gives a single DC, too high. The 2024
 * text leaves the point unstated, so the narrower contract holds for both.
 */
export function concentrationSaveDc(damage: number, edition: Edition): number {
  if (!Number.isInteger(damage) || damage < 0) {
    throw new RangeError(`Damage taken must be a non-negative integer, got ${damage}`);
  }
  const dc = Math.max(10, Math.floor(damage / 2));
  return edition === "one" ? Math.min(dc, CONCENTRATION_DC_CAP_ONE) : dc;
}

/**
 * Caster progression in upstream's own vocabulary, so no mapping table can drift.
 * `artificer` means half rounded up: the artificer, and the 2024 paladin and
 * ranger, where their 2014 versions round down. A third caster rounds down in both
 * editions — XPHB says "half your levels (round up)" and "one third ... (round
 * down)" in one passage, so the asymmetry is the rules', not an oversight here.
 * `pact` contributes nothing.
 */
const CASTER_PROGRESSIONS = ["full", "1/2", "1/3", "artificer", "pact"] as const;

type CasterProgression = (typeof CASTER_PROGRESSIONS)[number];

/** A class or subclass that casts, and the character's level in it. */
export type CasterClassLevel = {
  progression: CasterProgression;
  level: number;
};

type SpellSlotTotal = {
  level: number;
  total: number;
};

/**
 * A `Map` rather than an object, because a progression string comes from upstream
 * JSON: an object literal resolves `constructor` to `Object`, which passes an
 * `undefined` check and then contributes a number nobody wrote down.
 */
const CASTER_LEVEL_CONTRIBUTION = new Map<CasterProgression, (level: number) => number>([
  ["full", (level) => level],
  ["1/2", (level) => Math.floor(level / 2)],
  ["1/3", (level) => Math.floor(level / 3)],
  ["artificer", (level) => Math.ceil(level / 2)],
  ["pact", () => 0],
]);

/**
 * The single caster level that reads the multiclass slot table. Summing each
 * class's own slots instead is wrong, and wrong upward.
 */
export function multiclassCasterLevel(classes: readonly CasterClassLevel[]): number {
  const casterLevel = classes.reduce((total, entry) => {
    if (!Number.isInteger(entry.level) || entry.level < 1 || entry.level > 20) {
      throw new RangeError(`Class level must be 1-20, got ${entry.level}`);
    }
    const contribution = CASTER_LEVEL_CONTRIBUTION.get(entry.progression);
    if (!contribution) {
      throw new RangeError(`Unknown caster progression "${entry.progression}"`);
    }
    return total + contribution(entry.level);
  }, 0);
  // Caught here rather than in `multiclassSlots`, where the level no longer names
  // the classes it came from.
  if (casterLevel > 20) {
    throw new RangeError(`Class levels sum past 20, giving caster level ${casterLevel}`);
  }
  return casterLevel;
}

/**
 * Row n is caster level n + 1; the nine columns are slot levels 1-9. PHB p.165,
 * digit for digit any full caster's upstream `rowsSpellProgression` — check a
 * transposed digit here against the vendor data.
 */
const MULTICLASS_SLOTS: readonly (readonly number[])[] = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/**
 * Slots a combined caster level grants, lowest level first, omitting the levels
 * it grants none of. Caster level 0 grants nothing, which a pact-only warlock or
 * a level 1 paladin reaches legitimately.
 */
export function multiclassSlots(casterLevel: number): SpellSlotTotal[] {
  if (!Number.isInteger(casterLevel) || casterLevel < 0 || casterLevel > 20) {
    throw new RangeError(`Caster level must be 0-20, got ${casterLevel}`);
  }
  if (casterLevel === 0) {
    return [];
  }
  const row = MULTICLASS_SLOTS[casterLevel - 1] ?? [];
  return row.flatMap((slots, index) => (slots > 0 ? [{ level: index + 1, total: slots }] : []));
}

/**
 * How a classic prepared caster counts its level toward its prepared list:
 * `level` for the cleric, druid and wizard, `half-level` rounded down for the
 * paladin and the 2014 artificer. Not the caster progression above — an
 * artificer's caster level rounds *up* while its prepared count rounds down, so
 * one vocabulary serving both is wrong by a spell on every odd level.
 */
const PREPARATION_RULES = ["level", "half-level"] as const;

export type PreparationRule = (typeof PREPARATION_RULES)[number];

/**
 * Spells a `classic` caster prepares: the spellcasting ability modifier plus the
 * level the rule counts, floored at one. PHB p.56 (cleric), p.64 (druid), p.82
 * (paladin), p.112 (wizard); TCE p.9 (artificer).
 *
 * For `one`, read the `Prepared Spells` column from `class_resources` instead —
 * the 2024 rules state the count as a class-table column, and a second source for
 * one number is how the two drift.
 *
 * `classLevel` is the level in that class, never the character's total: a
 * multiclassed character prepares one list per class, so call this once per class.
 *
 * The caller decides whether the class casts at all: a PHB paladin has no
 * Spellcasting feature below level 2, while a TCE artificer has one at level 1. The
 * floor of one assumes a class that already casts.
 */
export function preparedSpellCount(
  spellcastingModifier: number,
  classLevel: number,
  rule: PreparationRule,
): number {
  assertInteger("A spellcasting modifier", spellcastingModifier);
  if (!Number.isInteger(classLevel) || classLevel < 1 || classLevel > 20) {
    throw new RangeError(`Class level must be 1-20, got ${classLevel}`);
  }
  if (!PREPARATION_RULES.includes(rule)) {
    throw new RangeError(`Unknown preparation rule "${rule}"`);
  }
  const levelCounted = rule === "half-level" ? Math.floor(classLevel / 2) : classLevel;
  return Math.max(1, spellcastingModifier + levelCounted);
}
