export const ADVANTAGE_MODES = ["advantage", "disadvantage"] as const;

export const ADVANTAGE_ROLLS = ["save", "skill", "check", "attack"] as const;

export type AdvantageMode = (typeof ADVANTAGE_MODES)[number];

export type AdvantageRoll = (typeof ADVANTAGE_ROLLS)[number];
