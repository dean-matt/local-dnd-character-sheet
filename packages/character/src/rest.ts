import { type HitDie, hitDicePick, resets, rest } from "@dnd/rules";
import type { CharacterDerived } from "./characterDerived.ts";
import { poolReset } from "./classResources.ts";
import type { CharacterDefinition } from "./definition.ts";
import type { Derived } from "./derivedField.ts";
import { classResourceKey } from "./keys.ts";
import { derivedValue, houseRule } from "./resolve.ts";
import type { CharacterState } from "./state.ts";

export type RestLength = "short" | "long";

type Resting = Pick<CharacterDefinition, "edition" | "houseRules">;

type Sheet = Pick<CharacterDerived, "hitDice" | "spellSlots" | "pactSlots" | "classResources">;

type Slot = NonNullable<CharacterState["pactSlots"]>;

function sheetHitDice(derived: Sheet, state: CharacterState): CharacterState["hitDice"] {
  return derived.hitDice.map((pool) => {
    const total = derivedValue(pool.total);
    const held = state.hitDice.find((candidate) => candidate.die === pool.die);
    return { die: pool.die, total, remaining: Math.min(held?.remaining ?? total, total) };
  });
}

function sheetSlot(slot: { level: number; total: Derived<number> }, held: Slot | undefined): Slot {
  const total = derivedValue(slot.total);
  return { level: slot.level, total, expended: Math.min(held?.expended ?? 0, total) };
}

function sheetClassResources(
  derived: Sheet,
  state: CharacterState,
): CharacterState["classResources"] {
  return derived.classResources.map((pool) => {
    const maximum = pool.maximum && derivedValue(pool.maximum);
    const held = state.classResources.find(
      (candidate) => classResourceKey(candidate) === classResourceKey(pool),
    );
    const expended = held?.expended ?? 0;
    return {
      class: pool.class,
      key: pool.key,
      maximum,
      expended: maximum === null ? expended : Math.min(expended, maximum),
    };
  });
}

/**
 * State measured against the totals the derived block shows, which is what the sheet reads
 * and a rest acts on: each pool and slot level the derived block lists, in its order, with
 * what remains or is expended from state capped at the total. A pool or slot level with none
 * in state has spent nothing, the way a new character's empty lists read. One the derived
 * block no longer lists, left by a class since removed, is dropped; pact slots carry their
 * expended count across a change of slot level. Class resource pools follow the same rule,
 * an `Unlimited` one never capping what is spent; the counters the user added in
 * `resources` pass through untouched.
 */
export function sheetState(derived: Sheet, state: CharacterState): CharacterState {
  return {
    ...state,
    hitDice: sheetHitDice(derived, state),
    spellSlots: derived.spellSlots.map((slot) =>
      sheetSlot(
        slot,
        state.spellSlots.find((held) => held.level === slot.level),
      ),
    ),
    pactSlots: derived.pactSlots && sheetSlot(derived.pactSlots, state.pactSlots ?? undefined),
    classResources: sheetClassResources(derived, state),
  };
}

const options = (definition: Resting) => ({
  edition: definition.edition,
  everyHitDie: houseRule(definition, "everyHitDieOnLongRest"),
});

/** What a long rest asks the player to pick, by `hitDicePick`, or null where it asks nothing. */
export function longRestHitDicePick(definition: Resting, derived: Sheet, state: CharacterState) {
  return hitDicePick(sheetState(derived, state).hitDice, options(definition));
}

/**
 * The state after a rest, by `rest`, for the character's edition and house rule. `picked`
 * names the hit dice to recover where `longRestHitDicePick` asks; `rest` throws a RangeError
 * where it is missing or out of bounds. Each class pool whose reset the rest meets has no
 * use spent; the others keep what was spent.
 */
export function restedState(
  definition: Resting,
  derived: Sheet,
  state: CharacterState,
  length: RestLength,
  picked?: readonly HitDie[],
): CharacterState {
  const rested = rest(sheetState(derived, state), {
    length,
    ...options(definition),
    picked,
  });
  return {
    ...rested,
    classResources: rested.classResources.map((pool) => {
      const trigger = poolReset(pool.key, definition.edition);
      return trigger && resets(trigger, length) ? { ...pool, expended: 0 } : pool;
    }),
  };
}
