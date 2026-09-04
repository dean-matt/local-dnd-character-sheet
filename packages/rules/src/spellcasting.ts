/**
 * Multiclass spellcasting: one combined caster level, read against one table.
 *
 * Both halves are here because summing each class's own slots instead is the
 * mistake the rules exist to prevent, and because this is the only rules area
 * with more to come — single-class slots and pact tables both arrive from
 * `content.db` rather than from arithmetic.
 *
 * The editions disagree about progression, so it is an argument and never an
 * edition branch: the 2024 paladin and ranger arrive carrying the round-up
 * progression, the 2014 ones do not.
 */

import { proficiencyBonus } from "./core.ts";

/**
 * Both take the total character level, never a caster level — proficiency comes
 * from the character, so passing `multiclassCasterLevel` here reads as if it
 * would work and is wrong by the difference between the two.
 */
export function spellSaveDc(spellcastingModifier: number, characterLevel: number): number {
  return 8 + proficiencyBonus(characterLevel) + spellcastingModifier;
}

export function spellAttackBonus(spellcastingModifier: number, characterLevel: number): number {
  return proficiencyBonus(characterLevel) + spellcastingModifier;
}

/**
 * Caster progression in upstream's own vocabulary, so there is no mapping table
 * to drift. `artificer` means half rounded up, which the 2024 paladin and
 * ranger also use; `pact` is warlock magic and contributes nothing here.
 */
export const CASTER_PROGRESSIONS = ["full", "1/2", "1/3", "artificer", "pact"] as const;

export type CasterProgression = (typeof CASTER_PROGRESSIONS)[number];

/** A class or subclass that casts, and the character's level in it. */
export type CasterClassLevel = {
  progression: CasterProgression;
  level: number;
};

export type SpellSlotTotal = {
  level: number;
  total: number;
};

/**
 * A `Map` rather than an object, because a progression string comes from upstream
 * JSON: an object literal resolves `constructor` to `Object`, which passes an
 * `undefined` check and then contributes a number nobody wrote down.
 *
 * 2024 rounds a half caster up and still rounds a third caster down — XPHB says
 * "half your levels (round up)" and "one third ... (round down)" in the same
 * passage. The asymmetry is upstream's and correct; do not tidy it.
 */
const CASTER_LEVEL_CONTRIBUTION = new Map<CasterProgression, (level: number) => number>([
  ["full", (level) => level],
  ["1/2", (level) => Math.floor(level / 2)],
  ["1/3", (level) => Math.floor(level / 3)],
  ["artificer", (level) => Math.ceil(level / 2)],
  ["pact", () => 0],
]);

/**
 * The single caster level the multiclass slot table is read with. Summing each
 * class's own slots instead would be wrong, and wrong upward.
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
 * which is digit for digit any full caster's upstream `rowsSpellProgression` —
 * that is how a transposed digit here can be checked against the vendor data.
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
 * it grants none of. Caster level 0 grants nothing, which a character with only
 * pact magic or a level 1 paladin reaches legitimately.
 */
export function multiclassSlots(casterLevel: number): SpellSlotTotal[] {
  if (!Number.isInteger(casterLevel) || casterLevel < 0 || casterLevel > 20) {
    throw new RangeError(`Caster level must be 0-20, got ${casterLevel}`);
  }
  const row = MULTICLASS_SLOTS[casterLevel - 1];
  if (!row) {
    return [];
  }
  return row.flatMap((slots, index) => (slots > 0 ? [{ level: index + 1, total: slots }] : []));
}
