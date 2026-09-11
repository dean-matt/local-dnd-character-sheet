/**
 * The 5e numbers derived from one ability score, one character level, or the
 * modifiers those produce.
 *
 * Terminal arithmetic: both rulesets agree on it, and none of it grows a second
 * input. Spellcasting and rest resets are their own files because neither is true
 * of them.
 */

/** Ability scores below 1 or above 30 are outside the rules; callers clamp before display. */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(totalLevel: number): number {
  if (totalLevel < 1 || totalLevel > 20) {
    throw new RangeError(`Total character level must be 1-20, got ${totalLevel}`);
  }
  return 2 + Math.floor((totalLevel - 1) / 4);
}

/**
 * A passive check rolls no die, so the modifiers are the whole score. Proficiency
 * arrives as a number rather than a flag because expertise doubles it and half
 * proficiency halves it. The sheet adds advantage's 5 or disadvantage's -5, because
 * only it knows the sources.
 */
export function passiveScore(modifier: number, proficiency: number): number {
  return 10 + modifier + proficiency;
}
