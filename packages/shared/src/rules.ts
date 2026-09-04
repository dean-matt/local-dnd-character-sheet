/**
 * Core 5e arithmetic shared by the API and the web client.
 *
 * Every function here is pure and takes what the editions disagree about as an
 * argument rather than branching on an edition: the 2024 paladin and ranger
 * arrive carrying the round-up caster progression, the 2014 ones do not.
 * Anything that cannot be passed in belongs with the content that carries the
 * `edition` column, not here.
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

// Multiclass spellcasting ------------------------------------------------------

/**
 * Caster progression in upstream's own vocabulary, so there is no mapping table
 * to drift. `artificer` means half rounded up, which the 2024 paladin and
 * ranger also use; `pact` is warlock magic and contributes nothing here.
 */
export const CASTER_PROGRESSIONS = ["full", "1/2", "1/3", "artificer", "pact"] as const;

export type CasterProgression = (typeof CASTER_PROGRESSIONS)[number];

/** A class or subclass that casts, and the character's level in it. */
export type CasterClassLevel = {
  progression: CasterProgression;
  level: number;
};

export type SpellSlotTotal = {
  level: number;
  total: number;
};

const CASTER_LEVEL_CONTRIBUTION: Record<CasterProgression, (level: number) => number> = {
  full: (level) => level,
  "1/2": (level) => Math.floor(level / 2),
  "1/3": (level) => Math.floor(level / 3),
  artificer: (level) => Math.ceil(level / 2),
  pact: () => 0,
};

/**
 * The single caster level the multiclass slot table is read with. Summing each
 * class's own slots instead would be wrong, and wrong upward.
 */
export function multiclassCasterLevel(classes: readonly CasterClassLevel[]): number {
  return classes.reduce((casterLevel, entry) => {
    if (!Number.isInteger(entry.level) || entry.level < 1 || entry.level > 20) {
      throw new RangeError(`Class level must be 1-20, got ${entry.level}`);
    }
    const contribution = CASTER_LEVEL_CONTRIBUTION[entry.progression];
    if (!contribution) {
      throw new RangeError(`Unknown caster progression "${entry.progression}"`);
    }
    return casterLevel + contribution(entry.level);
  }, 0);
}

/** Row n is caster level n + 1; the nine columns are slot levels 1-9. PHB p.165. */
const MULTICLASS_SLOTS: readonly (readonly number[])[] = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/**
 * Slots a combined caster level grants, lowest level first, omitting the levels
 * it grants none of. Caster level 0 grants nothing, which a character with only
 * pact magic or a level 1 paladin reaches legitimately.
 */
export function multiclassSlots(casterLevel: number): SpellSlotTotal[] {
  if (!Number.isInteger(casterLevel) || casterLevel < 0 || casterLevel > 20) {
    throw new RangeError(`Caster level must be 0-20, got ${casterLevel}`);
  }
  const row = MULTICLASS_SLOTS[casterLevel - 1];
  if (!row) {
    return [];
  }
  return row.flatMap((slots, index) => (slots > 0 ? [{ level: index + 1, total: slots }] : []));
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
