/**
 * What a level of exhaustion costs a creature.
 *
 * The rulesets disagree outright rather than in wording, so the edition discriminates
 * a union: 2014 is a six-row table of distinct effects, 2024 two penalties that scale
 * with the level. Both kill at 6, and both carry every level below the current one —
 * the 2014 rule says so and the 2024 arithmetic gives it for free.
 *
 * Reductions are magnitudes rather than negatives, as `encumbranceAt` returns them, so
 * a caller subtracts.
 */

import type { Edition } from "./edition.ts";

const MAX_LEVEL = 6;

const D20_TEST_PENALTY_PER_LEVEL = 2;

const FEET_LOST_PER_LEVEL = 5;

type ClassicExhaustion = {
  edition: "classic";
  abilityCheckDisadvantage: boolean;
  speedHalved: boolean;
  attackAndSaveDisadvantage: boolean;
  hitPointMaximumHalved: boolean;
  speedZero: boolean;
  dead: boolean;
};

type OneExhaustion = {
  edition: "one";
  /** Points off every D20 Test — the 2024 roll covers checks, attacks and saves alike. */
  d20TestPenalty: number;
  /** Feet of speed lost. */
  speedReduction: number;
  dead: boolean;
};

type ExhaustionEffects = ClassicExhaustion | OneExhaustion;

export function exhaustionEffects(level: number, edition: Edition): ExhaustionEffects {
  if (!Number.isInteger(level) || level < 0 || level > MAX_LEVEL) {
    throw new RangeError(`Exhaustion level must be an integer 0-${MAX_LEVEL}, got ${level}`);
  }
  const dead = level === MAX_LEVEL;
  if (edition === "one") {
    return {
      edition,
      d20TestPenalty: level * D20_TEST_PENALTY_PER_LEVEL,
      speedReduction: level * FEET_LOST_PER_LEVEL,
      dead,
    };
  }
  return {
    edition,
    abilityCheckDisadvantage: level >= 1,
    speedHalved: level >= 2,
    attackAndSaveDisadvantage: level >= 3,
    hitPointMaximumHalved: level >= 4,
    speedZero: level >= 5,
    dead,
  };
}
