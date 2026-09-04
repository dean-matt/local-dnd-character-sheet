/**
 * Core 5e arithmetic shared by the API and the web client.
 *
 * Every function here is pure and edition-agnostic. A rule the editions
 * disagree about takes the difference as an argument instead of branching, and
 * one that needs a lookup belongs with the content that carries the `edition`
 * column. Multiclass spellcasting has both and lives in `spellcasting.ts`.
 */
import type { ResetTrigger } from "./character.ts";

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

// Rest resets -----------------------------------------------------------------

/**
 * Upstream `recharge` values that map onto a trigger the sheet tracks. `dusk`,
 * `midnight` and `special` do not, so they degrade to `manual` rather than
 * widening the four triggers a character's resources are stored with.
 */
const RECHARGE_TRIGGERS: Record<string, ResetTrigger> = {
  restShort: "short",
  restLong: "long",
  dawn: "dawn",
};

export function resetsOn(recharge: string | null | undefined): ResetTrigger {
  if (!recharge) {
    return "manual";
  }
  return RECHARGE_TRIGGERS[recharge] ?? "manual";
}
