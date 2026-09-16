/**
 * Armor class, from the pieces a caller has already looked up.
 *
 * Both rulesets build the same sum: one base, the Dexterity modifier the base admits, a
 * shield, and whatever else adds flatly. The 2024 text states an unarmored character's
 * base where the 2014 text leaves it implicit; the numbers match, so no `Edition`
 * parameter.
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
 *
 * Required rather than defaulted, because the caller derives it from an armor `type`
 * that spans more values than the three armor categories — a missed case is a compile
 * error here and a silently generous armor class under a default.
 */
type DexterityCap = number | "none" | "all";

type ArmorClassParts = {
  /** The armor's own number, or the base an unarmored formula names. */
  base: number;
  dexterityModifier: number;
  dexterityCap: DexterityCap;
  /** A shield's own number, which stacks with every base. */
  shield?: number;
  /**
   * Every flat addition, summed by the caller: a magic item, a fighting style, and the
   * second ability modifier an unarmored formula adds.
   */
  bonus?: number;
};

/** Armor class is a whole number, so this rejects a fraction rather than rounding it. */
function assertInteger(label: string, value: number): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${label} must be an integer, got ${value}`);
  }
}

function admittedDexterity(modifier: number, cap: DexterityCap): number {
  if (cap === "none") {
    return 0;
  }
  if (cap === "all") {
    return modifier;
  }
  assertInteger("A Dexterity cap", cap);
  if (cap < 0) {
    throw new RangeError(`A Dexterity cap must be non-negative, got ${cap}`);
  }
  return Math.min(modifier, cap);
}

export function armorClass({
  base,
  dexterityModifier,
  dexterityCap,
  shield = 0,
  bonus = 0,
}: ArmorClassParts): number {
  assertInteger("A base armor class", base);
  assertInteger("A Dexterity modifier", dexterityModifier);
  assertInteger("A shield's armor class", shield);
  assertInteger("An armor class bonus", bonus);
  return base + admittedDexterity(dexterityModifier, dexterityCap) + shield + bonus;
}
