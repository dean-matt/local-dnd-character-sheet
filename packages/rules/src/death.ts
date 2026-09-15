/**
 * Dying, and the four ways out of it.
 *
 * One roll ends the dying four ways: a 20 restores a hit point outright, a 1 costs two
 * failures, a third success stabilizes, and a third failure kills. A sheet comparing
 * `failures >= 3` gets three of them wrong, so the outcome comes back beside the counts
 * rather than a caller deriving it. Damage taken at 0 hit points records a failure
 * without a roll, so it takes its own entry point.
 *
 * No `Edition` parameter. The 2024 ruleset moves this text under the Unconscious
 * condition and renames the headings, but the thresholds, the DC and both natural-roll
 * rules are word for word the 2014 ones.
 *
 * Stabilizing clears both counts, as both rulesets say, so a character who drops again
 * starts from zero.
 */

const REQUIRED = 3;

const SUCCESS_DC = 10;

const D20_FACES = 20;

const DOUBLE_FAILURE = 2;

type DeathSaves = {
  successes: number;
  failures: number;
};

/**
 * `dying` is still making saves. `conscious` is up at 1 hit point, which only a natural
 * 20 reaches — `stable` is at 0 and unconscious.
 */
type DeathSaveOutcome = "dying" | "stable" | "dead" | "conscious";

type DeathSaveResult = DeathSaves & {
  outcome: DeathSaveOutcome;
};

/** Both columns by name, so an absent one is rejected rather than skipped. */
function assertSaves(saves: DeathSaves): void {
  for (const label of ["successes", "failures"] as const) {
    const count = saves[label];
    if (!Number.isInteger(count) || count < 0 || count > REQUIRED) {
      throw new RangeError(`Death save ${label} must be an integer 0-${REQUIRED}, got ${count}`);
    }
  }
}

/** A fourth failure is the same death as the third, so the stored count stops at three. */
function settle(successes: number, failures: number): DeathSaveResult {
  if (failures >= REQUIRED) {
    return { successes, failures: REQUIRED, outcome: "dead" };
  }
  if (successes >= REQUIRED) {
    return { successes: 0, failures: 0, outcome: "stable" };
  }
  return { successes, failures, outcome: "dying" };
}

/** The d20 result, unmodified — nothing adds to a death saving throw. */
export function deathSave(saves: DeathSaves, roll: number): DeathSaveResult {
  assertSaves(saves);
  if (!Number.isInteger(roll) || roll < 1 || roll > D20_FACES) {
    throw new RangeError(`A d20 rolls 1-${D20_FACES}, got ${roll}`);
  }
  if (roll === D20_FACES) {
    return { successes: 0, failures: 0, outcome: "conscious" };
  }
  if (roll >= SUCCESS_DC) {
    return settle(saves.successes + 1, saves.failures);
  }
  return settle(saves.successes, saves.failures + (roll === 1 ? DOUBLE_FAILURE : 1));
}

/**
 * Damage taken at 0 hit points. Whether the damage kills outright by equalling the hit
 * point maximum is the caller's to judge, because that rule reads a number this one
 * never sees.
 */
export function damageAtZeroHitPoints(saves: DeathSaves, critical: boolean): DeathSaveResult {
  assertSaves(saves);
  return settle(saves.successes, saves.failures + (critical ? DOUBLE_FAILURE : 1));
}
