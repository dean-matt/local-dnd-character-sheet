/**
 * The 5e numbers derived from one ability score, one character level, or the
 * modifiers those produce.
 *
 * Terminal arithmetic: both rulesets agree on it, and none of it grows a second
 * input. Spellcasting and rest resets are their own files because neither is true
 * of them.
 */

import { type Breakdown, breakdown, type Term } from "./term.ts";

/** The six abilities, in the order a sheet prints them. */
export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;

export type Ability = (typeof ABILITIES)[number];

export const ABILITY_LABEL: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

/**
 * The highest score an increase from an Ability Score Improvement or a feat raises an
 * ability to, in both rulesets, unless what grants it names another: an Epic Boon names 30.
 */
export const IMPROVEMENT_CAP = 20;

/** Ability scores below 1 or above 30 are outside the rules; callers clamp before display. */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** The modifier as one term, named for the score it reads: the score is not a summand, so it goes in the label. */
export function abilityModifierBreakdown<Ref = unknown>(score: number): Breakdown<Ref> {
  return breakdown([{ label: `Score ${score}`, value: abilityModifier(score) }]);
}

export function proficiencyBonus(totalLevel: number): number {
  return proficiencyBonusBreakdown(totalLevel).total;
}

/** The base of +2 and the +1 every fourth level adds, so a sheet can show where a +4 came from. */
export function proficiencyBonusBreakdown<Ref = unknown>(totalLevel: number): Breakdown<Ref> {
  if (totalLevel < 1 || totalLevel > 20) {
    throw new RangeError(`Total character level must be 1-20, got ${totalLevel}`);
  }
  const terms: Term<Ref>[] = [{ label: "Base", value: 2 }];
  const steps = Math.floor((totalLevel - 1) / 4);
  if (steps > 0) terms.push({ label: `Level ${totalLevel} (+1 per 4 levels)`, value: steps });
  return breakdown(terms);
}

/** The Character Advancement table from level 1; both rulesets print the same column. */
const EXPERIENCE_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000,
  195000, 225000, 265000, 305000, 355000,
];

/** The experience points a character needs to reach a total level. */
export function experienceThreshold(totalLevel: number): number {
  const threshold = EXPERIENCE_THRESHOLDS[totalLevel - 1];
  if (threshold === undefined) {
    throw new RangeError(`Total character level must be 1-20, got ${totalLevel}`);
  }
  return threshold;
}

/**
 * A passive check rolls no die, so the modifiers are the whole score. Proficiency
 * arrives as a number rather than a flag because expertise doubles it and half
 * proficiency halves it — rounded down here, so half an odd bonus cannot reach the
 * sheet as a fraction. The sheet adds advantage's 5 or disadvantage's -5, because
 * only it knows the sources.
 */
export function passiveScore(modifier: number, proficiency: number): number {
  return Math.floor(10 + modifier + proficiency);
}

/**
 * How proficient a character is in one skill or tool. One value rather than a
 * `proficient` and an `expertise` flag, which can contradict each other and leave half
 * proficiency nowhere to go.
 */
export const PROFICIENCY_LEVELS = ["none", "half", "proficient", "expertise"] as const;

export type ProficiencyLevel = (typeof PROFICIENCY_LEVELS)[number];

/** Keyed by `ProficiencyLevel`, so a level added to the vocabulary fails to compile until it lands here. */
const PROFICIENCY_MULTIPLIER: Record<ProficiencyLevel, number> = {
  none: 0,
  half: 0.5,
  proficient: 1,
  expertise: 2,
};

/**
 * What a level of proficiency is worth at a character level: the number `passiveScore`
 * takes and a check adds. Rounded here rather than left to the caller, because half
 * proficiency is the only level that can produce a fraction and the rule already says
 * what to do with it — Jack of All Trades adds half the bonus rounded down.
 */
export function proficiencyContribution(totalLevel: number, level: ProficiencyLevel): number {
  return Math.floor(proficiencyBonus(totalLevel) * PROFICIENCY_MULTIPLIER[level]);
}
