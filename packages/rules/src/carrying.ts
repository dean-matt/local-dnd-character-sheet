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

/**
 * Both rulesets weigh every coin the same: fifty to the pound, whatever the
 * denomination, so a purse of copper weighs what the platinum it converts to does.
 * Upstream agrees — the five `PHB` denominations each state 0.02, where the 14 setting
 * coins under the same `$C` type state no weight at all — but a character
 * counts coins by denomination rather than holding an inventory row for them, so the
 * number is a rule here rather than a catalog lookup.
 */
export const POUNDS_PER_COIN = 0.02;

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

/** What a level of encumbrance costs a creature. */
type EncumbrancePenalty = {
  /** Feet of speed lost. */
  speedReduction: number;
  /**
   * Disadvantage on ability checks, attack rolls and saving throws that use
   * Strength, Dexterity or Constitution — the rule's own list, wider than the
   * ability checks alone.
   */
  disadvantage: boolean;
};

type EncumbranceThreshold = EncumbrancePenalty & {
  /** Pounds, exclusive: the rule reads "in excess of", so carrying exactly this costs nothing. */
  atWeight: number;
};

type EncumbranceThresholds = {
  encumbered: EncumbranceThreshold;
  heavilyEncumbered: EncumbranceThreshold;
};

const UNENCUMBERED: EncumbrancePenalty = { speedReduction: 0, disadvantage: false };
const ENCUMBERED: EncumbrancePenalty = { speedReduction: 10, disadvantage: false };
const HEAVILY_ENCUMBERED: EncumbrancePenalty = { speedReduction: 20, disadvantage: true };

/**
 * The weights at which the 2014 variant slows a creature, and what each costs.
 *
 * Flat multiples of the Strength score, because the size rule scales carrying,
 * pushing, dragging and lifting and names these nowhere. Size still enters through
 * the ceiling the rule does name — heavy encumbrance runs "up to your maximum
 * carrying capacity". Only a Tiny creature meets that ceiling first, so only Tiny
 * clamps; a Gargantuan creature is heavily encumbered at a twelfth of what it can
 * carry, which is the variant's own arithmetic and not an oversight here.
 */
export function encumbranceThresholds(strengthScore: number, size: Size): EncumbranceThresholds {
  const capacity = carryingCapacity(strengthScore, size);
  return {
    encumbered: { atWeight: Math.min(strengthScore * 5, capacity), ...ENCUMBERED },
    heavilyEncumbered: { atWeight: Math.min(strengthScore * 10, capacity), ...HEAVILY_ENCUMBERED },
  };
}

/**
 * What a creature carrying this weight suffers. Below the lighter threshold the
 * reduction is zero rather than absent, so a caller sums it into a speed without a
 * null check.
 */
export function encumbranceAt(
  strengthScore: number,
  size: Size,
  carriedWeight: number,
): EncumbrancePenalty {
  const { encumbered, heavilyEncumbered } = encumbranceThresholds(strengthScore, size);
  if (carriedWeight > heavilyEncumbered.atWeight) {
    return { ...HEAVILY_ENCUMBERED };
  }
  if (carriedWeight > encumbered.atWeight) {
    return { ...ENCUMBERED };
  }
  return { ...UNENCUMBERED };
}
