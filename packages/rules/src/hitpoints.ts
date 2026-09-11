/**
 * The hit point maximum, and the dice behind it.
 *
 * Every read sums the per-level list rather than adjusting the maximum by a delta,
 * because a Constitution modifier moves every level's contribution at once. A sheet
 * that adds the difference to the current maximum loses the levels whose rolls it no
 * longer knows.
 */

export const HIT_DICE = [6, 8, 10, 12] as const;

export type HitDie = (typeof HIT_DICE)[number];

/** One level's hit die, and the roll taken in place of the fixed value. */
export type HitPointLevel = {
  die: HitDie;
  rolled?: number;
};

/** Which ruleset the character plays under. The two long rests return hit dice differently. */
export type Edition = "classic" | "one";

/** The fixed value a class table prints, which is the die's average rounded up. */
export function averageHitPoints(die: HitDie): number {
  return Math.floor(die / 2) + 1;
}

function assertHitDie(die: number): asserts die is HitDie {
  if (!HIT_DICE.includes(die as HitDie)) {
    throw new RangeError(`Hit die must be one of ${HIT_DICE.join(", ")}, got ${die}`);
  }
}

function faceRolled(level: HitPointLevel, isFirstLevel: boolean): number {
  assertHitDie(level.die);
  if (isFirstLevel) {
    return level.die;
  }
  if (level.rolled === undefined) {
    return averageHitPoints(level.die);
  }
  if (!Number.isInteger(level.rolled) || level.rolled < 1 || level.rolled > level.die) {
    throw new RangeError(`A d${level.die} rolls 1-${level.die}, got ${level.rolled}`);
  }
  return level.rolled;
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
 * The most hit dice a long rest returns — the caller recovers the lesser of this
 * and the dice spent. The 2014 rest returns half the pool rounded down,
 * never fewer than one; the 2024 rest returns all of it.
 */
export function hitDiceRecovered(total: number, edition: Edition): number {
  if (!Number.isInteger(total) || total < 0) {
    throw new RangeError(`A hit dice pool holds 0 or more dice, got ${total}`);
  }
  if (edition === "one") {
    return total;
  }
  // The minimum of one floors the halving, rather than granting a die from an empty pool.
  return total === 0 ? 0 : Math.max(1, Math.floor(total / 2));
}
