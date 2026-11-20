/**
 * The expended spell slots held features recover, read from their recorded `slotRecovery`
 * mechanics, and the state a recovery leaves.
 */
import type { CharacterDerived } from "./characterDerived.ts";
import { mechanicsOfKind } from "./featureMechanics.ts";
import { type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";
import { sheetState } from "./rest.ts";
import type { CharacterState } from "./state.ts";

type Recovery = CharacterDerived["slotRecoveries"][number];

type Sheet = Pick<CharacterDerived, "hitDice" | "spellSlots" | "pactSlots" | "classResources">;

/** `count` expended slots of `level` to recover. */
export type SlotRecoveryPick = { level: number; count: number };

/** Each held feature's recovery, its budget half the levels in the feature's class, rounded up. */
export function slotRecoveries(definition: HoldsFeatures): Recovery[] {
  return heldFeatures(definition).flatMap(({ ref, entry, levels }) =>
    mechanicsOfKind(entry, "slotRecovery").map(({ maxLevel }) => ({
      feature: ref,
      budget: Math.ceil(levels / 2),
      maxLevel,
    })),
  );
}

/** The slot levels `recovery` can take with an expended slot, and how many are expended. */
export function recoverableSlots(
  derived: Sheet,
  state: CharacterState,
  recovery: Pick<Recovery, "maxLevel">,
): { level: number; expended: number }[] {
  return sheetState(derived, state)
    .spellSlots.filter((slot) => slot.level <= recovery.maxLevel && slot.expended > 0)
    .map(({ level, expended }) => ({ level, expended }));
}

/**
 * The state after `recovery` takes `picks`. Throws a RangeError where a pick is not a whole
 * number of expended slots of a level the recovery allows, none is picked, or their combined
 * level passes the budget.
 */
export function recoveredState(
  derived: Sheet,
  state: CharacterState,
  recovery: Pick<Recovery, "budget" | "maxLevel">,
  picks: readonly SlotRecoveryPick[],
): CharacterState {
  const available = recoverableSlots(derived, state, recovery);
  const spent = picks.reduce((sum, { level, count }) => sum + level * count, 0);
  if (spent < 1) throw new RangeError("pick at least one expended slot to recover");
  if (spent > recovery.budget)
    throw new RangeError(`${spent} levels of slots picked, ${recovery.budget} allowed`);
  const sheet = sheetState(derived, state);
  const regained = new Map<number, number>();
  for (const { level, count } of picks) {
    const held = available.find((slot) => slot.level === level);
    if (!Number.isInteger(count) || count < 0 || !held || regained.has(level))
      throw new RangeError(`no level ${level} slot can be recovered`);
    if (count > held.expended)
      throw new RangeError(`level ${level}: ${held.expended} expended, ${count} picked`);
    regained.set(level, count);
  }
  return {
    ...sheet,
    spellSlots: sheet.spellSlots.map((slot) => ({
      ...slot,
      expended: slot.expended - (regained.get(slot.level) ?? 0),
    })),
  };
}
