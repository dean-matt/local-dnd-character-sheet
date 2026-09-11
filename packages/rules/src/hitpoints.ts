/**
 * The hit point maximum, and the dice behind it.
 *
 * Every read sums the per-level list rather than adjusting the maximum by a delta,
 * because a Constitution modifier moves every level's contribution at once. A sheet
 * that adds the difference to the current maximum loses the levels whose rolls it no
 * longer knows.
 */

import type { Edition } from "./edition.ts";

export const HIT_DICE = [6, 8, 10, 12] as const;

export type HitDie = (typeof HIT_DICE)[number];

/** One level's hit die, and the roll taken in place of the fixed value. */
export type HitPointLevel = {
  die: HitDie;
  rolled?: number;
};

/** The fixed value a class table prints, which is the die's average rounded up. */
export function averageHitPoints(die: HitDie): number {
  assertHitDie(die);
  return Math.floor(die / 2) + 1;
}

function assertHitDie(die: number): asserts die is HitDie {
  if (!HIT_DICE.includes(die as HitDie)) {
    throw new RangeError(`Hit die must be one of ${HIT_DICE.join(", ")}, got ${die}`);
  }
}

function faceRolled(level: HitPointLevel, isFirstLevel: boolean): number {
  assertHitDie(level.die);
  // Checked even where the first level discards it, so a corrupt stored roll cannot
  // round-trip at the one position that ignores it.
  if (level.rolled !== undefined) {
    if (!Number.isInteger(level.rolled) || level.rolled < 1 || level.rolled > level.die) {
      throw new RangeError(`A d${level.die} rolls 1-${level.die}, got ${level.rolled}`);
    }
  }
  if (isFirstLevel) {
    return level.die;
  }
  return level.rolled ?? averageHitPoints(level.die);
}

/**
 * Levels in the order they were taken. The first takes its die's highest face and
 * ignores any roll on it, because 5e grants level 1 hit points once, to the class
 * the character started as.
 *
 * A level contributes at least 1, so a punishing Constitution modifier stalls the
 * maximum rather than reducing it.
 */
export function maxHitPoints(
  levels: readonly HitPointLevel[],
  constitutionModifier: number,
): number {
  if (levels.length === 0) {
    throw new RangeError("A character has at least one level");
  }
  return levels.reduce(
    (total, level, index) =>
      total + Math.max(1, faceRolled(level, index === 0) + constitutionModifier),
    0,
  );
}

/**
 * The most hit dice a long rest returns, given how many each die size totals —
 * the caller recovers the lesser of this and the dice spent, and picks the sizes.
 *
 * Totals and never the dice left unspent, because the rest is a fraction of what
 * the character has rather than of what is on the sheet right now. Every size at
 * once for the same reason: the 2014 rest halves the character's dice and not each
 * size's, so a d10 pool and a d6 pool of one die each return one die between them
 * where halving them apart would return two. The 2024 rest returns every die.
 */
export function hitDiceRecovered(totalsPerDie: readonly number[], edition: Edition): number {
  const total = totalsPerDie.reduce((sum, dice) => {
    if (!Number.isInteger(dice) || dice < 0) {
      throw new RangeError(`A hit dice pool holds 0 or more dice, got ${dice}`);
    }
    return sum + dice;
  }, 0);
  if (edition === "one" || total === 0) {
    return total;
  }
  return Math.max(1, Math.floor(total / 2));
}
