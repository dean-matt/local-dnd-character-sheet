/**
 * The 5e numbers derived from one ability score or one character level.
 *
 * Terminal arithmetic: the two rulesets agree on all of it, and none of it grows
 * a second input. Spellcasting and rest resets are their own files because both
 * of those things are false of them.
 */

/** Ability scores below 1 or above 30 are outside the rules; callers clamp before display. */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Proficiency bonus for a total character level, 1-20. */
export function proficiencyBonus(level: number): number {
  if (level < 1 || level > 20) {
    throw new RangeError(`Character level must be 1-20, got ${level}`);
  }
  return 2 + Math.floor((level - 1) / 4);
}
