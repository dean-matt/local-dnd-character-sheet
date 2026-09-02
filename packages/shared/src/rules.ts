/**
 * Core 5e arithmetic shared by the API and the web client.
 *
 * Every function here is pure and edition-agnostic: the 2014 and 2024 rulesets
 * agree on all of it. Edition-specific rules belong with the content that
 * carries the `edition` column, not here.
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

export function spellSaveDc(spellcastingModifier: number, level: number): number {
  return 8 + proficiencyBonus(level) + spellcastingModifier;
}

export function spellAttackBonus(spellcastingModifier: number, level: number): number {
  return proficiencyBonus(level) + spellcastingModifier;
}
