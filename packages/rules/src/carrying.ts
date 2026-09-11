/**
 * What a Strength score lets a creature carry, and the optional rule that slows a
 * creature carrying too much.
 *
 * Both rulesets agree on the weights: the 2024 Carrying Capacity table is the 2014
 * "Strength score x 15, doubled for each size above Medium" arithmetic written out
 * row by row. Encumbrance is a 2014 variant with no 2024 counterpart in either the
 * Player's Handbook or the Dungeon Master's Guide, so it stays an opt-in rather
 * than an edition branch.
 */

export const SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"] as const;

export type Size = (typeof SIZES)[number];

/** Keyed by `Size`, so adding a size to the vocabulary fails to compile until it lands here. */
const SIZE_MULTIPLIER: Record<Size, number> = {
  tiny: 0.5,
  small: 1,
  medium: 1,
  large: 2,
  huge: 4,
  gargantuan: 8,
};

const POUNDS_PER_STRENGTH_POINT = 15;

/** Upstream spells sizes `T` through `G`, which the caller translates. */
function multiplierFor(size: Size): number {
  // `hasOwn` rather than a truthiness check, so an inherited key cannot answer for a size.
  if (!Object.hasOwn(SIZE_MULTIPLIER, size)) {
    throw new RangeError(`Unknown size "${size}"`);
  }
  return SIZE_MULTIPLIER[size];
}

/** Pounds, and fractional for a Tiny creature — upstream's own table reads "Str. x 7.5". */
export function carryingCapacity(strengthScore: number, size: Size): number {
  return strengthScore * POUNDS_PER_STRENGTH_POINT * multiplierFor(size);
}

/** Pushing, dragging and lifting share one limit: twice what the creature can carry. */
export function pushDragLiftCapacity(strengthScore: number, size: Size): number {
  return carryingCapacity(strengthScore, size) * 2;
}

export type EncumbranceThresholds = {
  encumbered: number;
  heavilyEncumbered: number;
};

/**
 * The weights at which the 2014 variant slows a creature: speed drops 10 feet at
 * the first and 20 feet at the second, which also imposes disadvantage on Strength,
 * Dexterity and Constitution rolls.
 *
 * Flat multiples of the Strength score, because the size rule scales carrying,
 * pushing, dragging and lifting and names these nowhere. Size still enters through
 * the ceiling the rule does name — heavy encumbrance runs "up to your maximum
 * carrying capacity", which for a Tiny creature arrives first and leaves the band
 * empty rather than inverted.
 */
export function encumbranceThresholds(strengthScore: number, size: Size): EncumbranceThresholds {
  const capacity = carryingCapacity(strengthScore, size);
  return {
    encumbered: Math.min(strengthScore * 5, capacity),
    heavilyEncumbered: Math.min(strengthScore * 10, capacity),
  };
}
