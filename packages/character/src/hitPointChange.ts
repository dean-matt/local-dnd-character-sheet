import { heal, takeDamage } from "@dnd/rules";
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
 * under the table's `noInstantDeath`. `critical` counts only at 0 hit points, as the rule does.
 */
export function damagedState(
  definition: Pick<CharacterDefinition, "houseRules">,
  derived: Sheet,
  state: CharacterState,
  amount: number,
  critical: boolean,
): Changed {
  const result = takeDamage(
    state.hitPoints,
    state.deathSaves,
    derivedValue(derived.hitPointMaximum),
    amount,
    { critical, instantDeath: !houseRule(definition, "noInstantDeath") },
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
