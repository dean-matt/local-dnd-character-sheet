/**
 * Damage and healing applied to hit points, and what they do to the death saves.
 *
 * Both take the stored shape: a null `current` reads as the maximum, and healing to the
 * maximum writes null back, so an unhurt character keeps pace with a level-up.
 *
 * The outcome reads `dying` for any living character at 0, stable or not: stability lives
 * in how a caller stores the counts, not here, and any damage ends it anyway.
 *
 * No `Edition` parameter: temporary hit points, the healing cap and instant death read the
 * same in the 2014 and 2024 rulesets.
 */

import {
  assertSaves,
  type DeathSaveOutcome,
  type DeathSaves,
  damageAtZeroHitPoints,
  REQUIRED as FATAL_FAILURES,
} from "./death.ts";

type HitPoints = {
  current: number | null;
  temporary: number;
};

type HitPointResult = {
  hitPoints: HitPoints;
  deathSaves: DeathSaves;
  outcome: Exclude<DeathSaveOutcome, "stable">;
};

type DamageOptions = {
  critical: boolean;
  /** False: a massive hit follows the death saves like any other. */
  instantDeath: boolean;
};

function assertInputs(hitPoints: HitPoints, saves: DeathSaves, maximum: number, amount: number) {
  assertSaves(saves);
  if (!Number.isInteger(maximum) || maximum < 1) {
    throw new RangeError(`A hit point maximum is a whole number of 1 or more, got ${maximum}`);
  }
  if (hitPoints.current !== null && !Number.isInteger(hitPoints.current)) {
    throw new RangeError(`Current hit points must be an integer, got ${hitPoints.current}`);
  }
  if (!Number.isInteger(hitPoints.temporary) || hitPoints.temporary < 0) {
    throw new RangeError(`Temporary hit points are 0 or more, got ${hitPoints.temporary}`);
  }
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError(`An amount of damage or healing is 0 or more, got ${amount}`);
  }
}

/** A stored negative reads as 0, since nothing here writes one. */
function currentOf(hitPoints: HitPoints, maximum: number): number {
  return Math.max(0, hitPoints.current ?? maximum);
}

function unchanged(hitPoints: HitPoints, saves: DeathSaves, maximum: number): HitPointResult {
  const outcome =
    saves.failures >= FATAL_FAILURES
      ? "dead"
      : currentOf(hitPoints, maximum) > 0
        ? "conscious"
        : "dying";
  return { hitPoints, deathSaves: saves, outcome };
}

/**
 * `amount` is the damage after resistance, vulnerability and immunity. Temporary hit points
 * take it first, and only what passes them reaches `current` or counts toward instant death.
 * Damage fully absorbed at 0 records no failure, because the character took none.
 */
export function takeDamage(
  hitPoints: HitPoints,
  saves: DeathSaves,
  maximum: number,
  amount: number,
  { critical, instantDeath }: DamageOptions,
): HitPointResult {
  assertInputs(hitPoints, saves, maximum, amount);
  if (amount === 0 || saves.failures >= FATAL_FAILURES) {
    return unchanged(hitPoints, saves, maximum);
  }
  const absorbed = Math.min(hitPoints.temporary, amount);
  const temporary = hitPoints.temporary - absorbed;
  const through = amount - absorbed;
  const current = currentOf(hitPoints, maximum);
  if (through === 0) {
    return unchanged({ current: hitPoints.current, temporary }, saves, maximum);
  }
  const remainder = through - current;
  if (instantDeath && remainder >= maximum) {
    return {
      hitPoints: { current: 0, temporary },
      deathSaves: { successes: 0, failures: FATAL_FAILURES },
      outcome: "dead",
    };
  }
  if (current === 0) {
    const { outcome, ...deathSaves } = damageAtZeroHitPoints(saves, critical);
    return {
      hitPoints: { current: 0, temporary },
      deathSaves,
      outcome: outcome === "dead" ? "dead" : "dying",
    };
  }
  if (remainder >= 0) {
    return {
      hitPoints: { current: 0, temporary },
      deathSaves: { successes: 0, failures: 0 },
      outcome: "dying",
    };
  }
  return {
    hitPoints: { current: current - through, temporary },
    deathSaves: saves,
    outcome: "conscious",
  };
}

/**
 * Healing never lifts `current` past the maximum, and leaves a `current` already above it
 * where it stands. It never touches `temporary`, and a dead character stays dead.
 */
export function heal(
  hitPoints: HitPoints,
  saves: DeathSaves,
  maximum: number,
  amount: number,
): HitPointResult {
  assertInputs(hitPoints, saves, maximum, amount);
  const current = currentOf(hitPoints, maximum);
  if (amount === 0 || saves.failures >= FATAL_FAILURES || current > maximum) {
    return unchanged(hitPoints, saves, maximum);
  }
  const healed = Math.min(maximum, current + amount);
  return {
    hitPoints: { current: healed === maximum ? null : healed, temporary: hitPoints.temporary },
    deathSaves: current === 0 ? { successes: 0, failures: 0 } : saves,
    outcome: "conscious",
  };
}
