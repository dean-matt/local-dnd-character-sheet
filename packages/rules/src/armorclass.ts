/**
 * Armor class, from the pieces a caller has already looked up.
 *
 * Both rulesets build the same sum: one base, the Dexterity modifier the base admits, a
 * shield, and whatever else adds flatly. The 2024 text states an unarmored
 * character's base where the 2014 text leaves it implicit; the numbers match, so no
 * `Edition` parameter.
 *
 * Which armor a character wears, whether they are proficient with it, and which
 * unarmored formula their class grants each need the whole character, so they stay in
 * the projection over the definition and arrive here as numbers.
 */

/**
 * How much of the Dexterity modifier the base admits. A number is a ceiling rather than
 * a clamp, so a negative modifier still subtracts under medium armor's maximum of +2.
 * `"none"` ignores the modifier outright, which is heavy armor's rule: a ceiling of 0
 * would still subtract a negative one.
 */
type DexterityCap = number | "none";

type ArmorClassParts = {
  /** The armor's own number, or the base an unarmored formula names. */
  base: number;
  dexterityModifier: number;
  /** Absent admits the whole modifier: light armor and every unarmored formula. */
  dexterityCap?: DexterityCap;
  /** A shield's own number, which stacks with every base. */
  shield?: number;
  /**
   * Every flat addition, summed by the caller: a magic item, a fighting style, and the
   * second ability modifier an unarmored formula adds.
   */
  bonus?: number;
};

function admittedDexterity(modifier: number, cap: DexterityCap | undefined): number {
  if (cap === "none") {
    return 0;
  }
  if (cap === undefined) {
    return modifier;
  }
  if (!Number.isInteger(cap) || cap < 0) {
    throw new RangeError(`A Dexterity cap must be a non-negative integer or "none", got ${cap}`);
  }
  return Math.min(modifier, cap);
}

/**
 * An unarmored formula passes its own `base` rather than a flag, because only one base
 * calculation applies at a time and only the caller knows which.
 */
export function armorClass({
  base,
  dexterityModifier,
  dexterityCap,
  shield = 0,
  bonus = 0,
}: ArmorClassParts): number {
  return base + admittedDexterity(dexterityModifier, dexterityCap) + shield + bonus;
}
