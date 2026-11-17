import type { RollRecord } from "@dnd/character";

export type RollPenalty = { source: string; value: number };

/**
 * The roll with `penalty` taken off its bonus and named as a term after the terms it had, or
 * after one `base` names for the whole bonus. A roll with no penalty comes back unchanged.
 */
export function penalised<R extends { bonus: number }>(
  roll: R & { terms?: RollRecord["terms"] },
  penalty: RollPenalty | undefined,
  base = "Bonus",
): R & { terms?: RollRecord["terms"] } {
  if (!penalty) return roll;
  const terms = roll.terms ?? [{ source: base, value: roll.bonus }];
  return { ...roll, bonus: roll.bonus + penalty.value, terms: [...terms, penalty] };
}
