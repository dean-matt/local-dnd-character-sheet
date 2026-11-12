import {
  adjustedDamage,
  type DamageDefense,
  deathSave,
  type HitDie,
  heal,
  hitDieHealing,
  REQUIRED_DEATH_SAVES,
  takeDamage,
} from "@dnd/rules";
import type { CharacterDerived } from "./characterDerived.ts";
import { concentrationLapsed } from "./concentration.ts";
import type { CharacterDefinition } from "./definition.ts";
import { rageEnded } from "./rage.ts";
import { derivedValue, houseRule } from "./resolve.ts";
import { sheetState } from "./rest.ts";
import type { CharacterState } from "./state.ts";

type Sheet = Pick<CharacterDerived, "hitPointMaximum">;

type HitDiceSheet = Sheet &
  Pick<
    CharacterDerived,
    "hitDice" | "spellSlots" | "pactSlots" | "classResources" | "abilityModifiers"
  >;

type Changed = { state: CharacterState; outcome: ReturnType<typeof heal>["outcome"] };

function changed(state: CharacterState, result: ReturnType<typeof heal>): Changed {
  return {
    state: { ...state, hitPoints: result.hitPoints, deathSaves: result.deathSaves },
    outcome: result.outcome,
  };
}

/**
 * The defenses the sheet shows against damage of `type`: those the derived block grants, a
 * rage's among them while one is active, and those the player added by hand.
 */
function defensesAgainst(
  definition: Pick<CharacterDefinition, "addedDefenses">,
  derived: Pick<CharacterDerived, "defenses">,
  type: string,
): DamageDefense[] {
  const granted = derivedValue(derived.defenses);
  const { addedDefenses: added } = definition;
  const holds = (grants: readonly { name: string }[], names: readonly string[] = []) =>
    grants.some(({ name }) => name === type) || names.includes(type);
  return [
    ...(holds(granted.damageImmunities, added.damageImmunities) ? (["immunity"] as const) : []),
    ...(holds(granted.resistances, added.resistances) ? (["resistance"] as const) : []),
    ...(holds(granted.vulnerabilities) ? (["vulnerability"] as const) : []),
  ];
}

/**
 * The state after `amount` damage of `type`, by `takeDamage`, against the maximum the sheet
 * shows and under the table's `noInstantDeath`. Typed damage first meets the defenses the sheet
 * shows against it, by `adjustedDamage`; untyped damage applies as given. Returns the amount
 * taken and the defenses that changed it. Damage at 0 counts one death save failure, or two
 * from a `critical` hit. Damage that leaves the character at 0 ends concentration, by
 * `concentrationLapsed`, and any rage, by `rageEnded`.
 */
export function damagedState(
  definition: Pick<CharacterDefinition, "houseRules" | "addedDefenses">,
  derived: Sheet & Pick<CharacterDerived, "defenses">,
  state: CharacterState,
  amount: number,
  { type, critical = false }: { type?: string; critical?: boolean } = {},
): Changed & ReturnType<typeof adjustedDamage> {
  const adjusted = adjustedDamage(
    amount,
    type === undefined ? [] : defensesAgainst(definition, derived, type),
  );
  const result = takeDamage(
    state.hitPoints,
    state.deathSaves,
    derivedValue(derived.hitPointMaximum),
    adjusted.amount,
    { instantDeath: !houseRule(definition, "noInstantDeath"), critical },
  );
  const after = changed(state, result);
  const lapsed = concentrationLapsed(after.state);
  return {
    ...after,
    state: lapsed.hitPoints.current === 0 ? rageEnded(lapsed) : lapsed,
    ...adjusted,
  };
}

/** The state after `amount` healing, by `heal`, against the maximum the sheet shows. */
export function healedState(derived: Sheet, state: CharacterState, amount: number): Changed {
  return changed(
    state,
    heal(state.hitPoints, state.deathSaves, derivedValue(derived.hitPointMaximum), amount),
  );
}

/** Whether the character's hit points stand at the maximum the sheet shows. */
export function atHitPointMaximum(derived: Sheet, state: CharacterState): boolean {
  const maximum = derivedValue(derived.hitPointMaximum);
  return (state.hitPoints.current ?? maximum) >= maximum;
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

/**
 * The state after spending one `die` hit die on a face of `roll`, or undefined where the
 * character is dead, already at maximum hit points, or the sheet's pool for that size has
 * none left. The pool loses one die and the hit points gain the roll plus the Constitution
 * modifier the sheet shows, by `hitDieHealing` and `healedState`, in the one state.
 */
export function hitDieSpentState(
  definition: Pick<CharacterDefinition, "edition">,
  derived: HitDiceSheet,
  state: CharacterState,
  die: HitDie,
  roll: number,
): { state: CharacterState; regained: number; modifier: number } | undefined {
  if (deathSaveStatus(derived, state) === "dead") return undefined;
  if (atHitPointMaximum(derived, state)) return undefined;
  const held = sheetState(derived, state);
  const pool = held.hitDice.find((candidate) => candidate.die === die);
  if (!pool || pool.remaining < 1) return undefined;
  const modifier = derivedValue(derived.abilityModifiers.con);
  const regained = hitDieHealing(roll, modifier, definition.edition);
  const spent = {
    ...held,
    hitDice: held.hitDice.map((each) =>
      each.die === die ? { ...each, remaining: each.remaining - 1 } : each,
    ),
  };
  return { state: healedState(derived, spent, regained).state, regained, modifier };
}
