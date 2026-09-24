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
 *
 * The arithmetic knows what a base, a Dexterity modifier and a shield mean, so it
 * labels those terms itself; only the caller knows which catalog row supplied one, so
 * it attaches that as a reference and gets it back unexamined. A flat bonus can come
 * from more than one source at once, so its label is the caller's to give.
 */

import { assertInteger } from "./integer.ts";
import { type Breakdown, breakdown, type Term, type TermInput } from "./term.ts";

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

type ArmorClassParts<Ref = unknown> = {
  /** The armor's own number, or the base an unarmored formula names. */
  base: TermInput<Ref>;
  dexterityModifier: TermInput<Ref>;
  dexterityCap: DexterityCap;
  /** A shield's own number, which stacks with every base. */
  shield?: TermInput<Ref>;
  /**
   * Every flat addition, one term per source: a magic item, a fighting style, and the
   * second ability modifier an unarmored formula adds.
   */
  bonus?: Term<Ref>[];
};

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

export function armorClass<Ref = unknown>({
  base,
  dexterityModifier,
  dexterityCap,
  shield,
  bonus = [],
}: ArmorClassParts<Ref>): Breakdown<Ref> {
  assertInteger("A base armor class", base.value);
  assertInteger("A Dexterity modifier", dexterityModifier.value);
  if (shield !== undefined) {
    assertInteger("A shield's armor class", shield.value);
  }
  for (const term of bonus) {
    assertInteger(`A bonus of ${term.value} (${term.label})`, term.value);
  }

  const terms: Term<Ref>[] = [
    { label: "Armor", value: base.value, reference: base.reference },
    {
      label: "Dexterity",
      value: admittedDexterity(dexterityModifier.value, dexterityCap),
      reference: dexterityModifier.reference,
    },
  ];
  if (shield !== undefined) {
    terms.push({ label: "Shield", value: shield.value, reference: shield.reference });
  }
  terms.push(...bonus);
  return breakdown(terms);
}
