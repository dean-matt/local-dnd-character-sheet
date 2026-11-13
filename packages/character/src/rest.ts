import { type HitDie, hitDicePick, resets, rest } from "@dnd/rules";
import type { CharacterDerived } from "./characterDerived.ts";
import { poolReset, regainsOneOnShortRest } from "./classResources.ts";
import { concentrationEnded } from "./concentration.ts";
import type { CharacterDefinition } from "./definition.ts";
import type { Derived } from "./derivedField.ts";
import { classResourceKey } from "./keys.ts";
import { rageEnded } from "./rage.ts";
import { derivedValue, houseRule } from "./resolve.ts";
import { type CharacterState, itemChargesSpent } from "./state.ts";

export type RestLength = "short" | "long";

type Resting = Pick<CharacterDefinition, "edition" | "houseRules">;

type Sheet = Pick<CharacterDerived, "hitDice" | "spellSlots" | "pactSlots" | "classResources">;

type Slot = NonNullable<CharacterState["pactSlots"]>;

/** An item's charges as the inventory endpoint lists them, and how many a long rest returns to it. */
type ItemRecharge = { id: string; max: number; regained: number };

/** A feature's limited uses as the features endpoint lists them: `short` uses return on any rest. */
type FeatureReset = { key: string; reset: RestLength };

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

function longRestEnded(state: CharacterState): CharacterState {
  const reduction = state.hitPointMaximumReduction;
  return {
    ...concentrationEnded(state),
    hitPointMaximumReduction: reduction?.clearsOnLongRest ? null : reduction,
  };
}

/**
 * The state after a rest, by `rest`, for the character's edition and house rule. `picked`
 * names the hit dice to recover where `longRestHitDicePick` asks; `rest` throws a RangeError
 * where it is missing or out of bounds. Each class pool whose reset the rest meets has no
 * use spent; a 2024 pool with a partial recharge regains one use on a short rest, and the
 * others keep what was spent. Each feature in `features` whose reset the rest meets has no
 * use spent. A long rest returns `regained` charges to each of `itemRecharges`, never past
 * what was spent,. Any rest ends a rage; a long rest also ends concentration and clears a reduction
 * to the hit point maximum that a long rest clears.
 */
export function restedState(
  definition: Resting,
  derived: Sheet,
  state: CharacterState,
  length: RestLength,
  picked?: readonly HitDie[],
  features: readonly FeatureReset[] = [],
  itemRecharges: readonly ItemRecharge[] = [],
): CharacterState {
  const rested = rest(sheetState(derived, state), {
    length,
    ...options(definition),
    picked,
  });
  const ended = rageEnded(rested);
  return {
    ...(length === "long" ? longRestEnded(ended) : ended),
    classResources: rested.classResources.map((pool) => {
      const homebrew = derived.classResources.find(
        (candidate) => classResourceKey(candidate) === classResourceKey(pool),
      )?.resets;
      if (homebrew !== undefined) {
        return homebrew && resets(homebrew, length) ? { ...pool, expended: 0 } : pool;
      }
      const trigger = poolReset(pool.key, definition.edition);
      if (trigger && resets(trigger, length)) return { ...pool, expended: 0 };
      return length === "short" && regainsOneOnShortRest(pool.key, definition.edition)
        ? { ...pool, expended: Math.max(0, pool.expended - 1) }
        : pool;
    }),
    itemCharges:
      length === "long"
        ? rested.itemCharges.flatMap(({ id, expended }) => {
            const recharge = itemRecharges.find((item) => item.id === id);
            if (!recharge) return [{ id, expended }];
            const left = itemChargesSpent(rested, id, recharge.max) - recharge.regained;
            return left > 0 ? [{ id, expended: left }] : [];
          })
        : rested.itemCharges,
    featureUses: rested.featureUses.filter(
      (use) =>
        !features.some((feature) => feature.key === use.key && resets(feature.reset, length)),
    ),
  };
}
