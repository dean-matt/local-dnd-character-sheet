import { deathSave, heal, REQUIRED_DEATH_SAVES, takeDamage } from "@dnd/rules";
import type { CharacterDerived } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import { derivedValue, houseRule } from "./resolve.ts";
import type { CharacterState } from "./state.ts";

type Sheet = Pick<CharacterDerived, "hitPointMaximum">;

type Changed = { state: CharacterState; outcome: ReturnType<typeof heal>["outcome"] };

function changed(state: CharacterState, result: ReturnType<typeof heal>): Changed {
  return {
    state: { ...state, hitPoints: result.hitPoints, deathSaves: result.deathSaves },
    outcome: result.outcome,
  };
}

/**
 * The state after `amount` damage, by `takeDamage`, against the maximum the sheet shows and
 * under the table's `noInstantDeath`. Damage at 0 counts as one failure: for a critical hit
 * the player marks the second failure by hand.
 */
export function damagedState(
  definition: Pick<CharacterDefinition, "houseRules">,
  derived: Sheet,
  state: CharacterState,
  amount: number,
): Changed {
  const result = takeDamage(
    state.hitPoints,
    state.deathSaves,
    derivedValue(derived.hitPointMaximum),
    amount,
    { critical: false, instantDeath: !houseRule(definition, "noInstantDeath") },
  );
  return changed(state, result);
}

/** The state after `amount` healing, by `heal`, against the maximum the sheet shows. */
export function healedState(derived: Sheet, state: CharacterState, amount: number): Changed {
  return changed(
    state,
    heal(state.hitPoints, state.deathSaves, derivedValue(derived.hitPointMaximum), amount),
  );
}

/**
 * Where a character at 0 hit points stands, read from the stored counts, or undefined above
 * 0. Three successes read as stable because the sheet stores them where `deathSave` clears
 * both counts, so a stable character is told apart from one who just dropped. Death wins
 * where both columns read three.
 */
export function deathSaveStatus(
  derived: Sheet,
  state: CharacterState,
): "dying" | "stable" | "dead" | undefined {
  if ((state.hitPoints.current ?? derivedValue(derived.hitPointMaximum)) > 0) return undefined;
  if (state.deathSaves.failures >= REQUIRED_DEATH_SAVES) return "dead";
  if (state.deathSaves.successes >= REQUIRED_DEATH_SAVES) return "stable";
  return "dying";
}

/**
 * The state after a death save of `roll` on the d20, by `deathSave`. A 20 heals 1 hit point,
 * through `heal`, so a maximum of 1 writes null as any heal to the maximum does. A third
 * success stores three successes for `deathSaveStatus` to read.
 */
export function deathSaveRolledState(
  derived: Sheet,
  state: CharacterState,
  roll: number,
): { state: CharacterState; outcome: ReturnType<typeof deathSave>["outcome"] } {
  const { outcome, ...counts } = deathSave(state.deathSaves, roll);
  if (outcome === "conscious") return healedState(derived, state, 1);
  const deathSaves =
    outcome === "stable" ? { successes: REQUIRED_DEATH_SAVES, failures: 0 } : counts;
  return { state: { ...state, deathSaves }, outcome };
}
