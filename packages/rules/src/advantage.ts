/** Whether a d20 roll is made with advantage or with disadvantage. */
export const ADVANTAGE_MODES = ["advantage", "disadvantage"] as const;

/** The rolls an effect can mark: a saving throw, a skill, an ability check or an attack roll. */
export const ADVANTAGE_ROLLS = ["save", "skill", "check", "attack"] as const;

export type AdvantageMode = (typeof ADVANTAGE_MODES)[number];

export type AdvantageRoll = (typeof ADVANTAGE_ROLLS)[number];
