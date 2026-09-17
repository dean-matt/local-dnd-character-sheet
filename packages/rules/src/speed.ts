/**
 * What a creature's speed becomes once every reduction in play has applied.
 *
 * Two rules reduce a speed and neither says how they combine: the 2014 exhaustion table
 * halves it from level 2, and the 2014 encumbrance variant drops it by a flat 10 or 20
 * feet. The order decides the answer — a Wood Elf at 35 feet, heavily encumbered and two
 * levels exhausted, walks 7 feet subtracting first and none at all halving first.
 *
 * The exhaustion table settles it. Level 2 halves the speed and level 5 sets it to zero,
 * and the table keeps those rows apart, so a creature at level 2 is meant to still move.
 * Only halving last holds them apart. No walking speed upstream prints is above 40, so
 * halving first hands heavy encumbrance a speed of 20 or less and the load alone stops
 * every creature in the game — the level-2 row read as the level-5 row. Subtracting
 * first, the printed speeds above 20 keep something: 25 walks 2 feet and 35 walks 7. A
 * race that walks 20 or 10 stops under that load either way, which is the load's doing
 * rather than the order's. So the flat reductions come off first and the halving takes
 * what is left.
 *
 * That leaves one division, and a halved odd speed rounds down as the rulesets round
 * down on every division.
 *
 * Reductions arrive as magnitudes, as `encumbranceAt` and `exhaustionEffects` return
 * them.
 */

import { assertInteger } from "./integer.ts";

type SpeedReductions = {
  /** Feet per round before anything reduces it, for one movement mode. */
  base: number;
  /**
   * Every flat reduction in play, summed by the caller: encumbrance, 2024 exhaustion,
   * and whatever else subtracts feet.
   */
  reduction?: number;
  /** 2014 exhaustion from level 2. */
  halved?: boolean;
  /**
   * 2014 exhaustion from level 5, which states a speed of 0 rather than a reduction and
   * so answers before any arithmetic runs.
   */
  zeroed?: boolean;
};

/** Feet per round, floored at zero: a creature is immobile rather than moving backwards. */
export function reducedSpeed({
  base,
  reduction = 0,
  halved = false,
  zeroed = false,
}: SpeedReductions): number {
  assertInteger("A base speed", base);
  assertInteger("A speed reduction", reduction);
  if (base < 0) {
    throw new RangeError(`A base speed must be non-negative, got ${base}`);
  }
  if (reduction < 0) {
    throw new RangeError(`A speed reduction must be non-negative, got ${reduction}`);
  }
  if (zeroed) {
    return 0;
  }
  const remaining = Math.max(0, base - reduction);
  return halved ? Math.floor(remaining / 2) : remaining;
}
