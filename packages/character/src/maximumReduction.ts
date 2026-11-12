import { type Breakdown, breakdown } from "@dnd/rules";
import type { CharacterDerived } from "./characterDerived.ts";
import type { TermReference } from "./derivedField.ts";
import type { CharacterState, HitPointMaximumReduction } from "./state.ts";

/** The label of the term a reduction adds to the hit point maximum's breakdown. */
const REDUCTION_LABEL = "Maximum reduction";

type Sheet = Pick<CharacterDerived, "hitPointMaximum">;

/** What `reduction` takes from `unreduced`, leaving at least 1: a reduction to 0 kills, which the sheet leaves to the player. */
const taken = (unreduced: number, reduction: HitPointMaximumReduction | null) =>
  Math.max(0, Math.min(reduction?.amount ?? 0, unreduced - 1));

/** `maximum` with a term for what `reduction` takes from it, or as given where it takes nothing. */
export function reducedMaximum(
  maximum: Breakdown<TermReference>,
  reduction: HitPointMaximumReduction | null,
): Breakdown<TermReference> {
  const amount = taken(maximum.total, reduction);
  return amount === 0
    ? maximum
    : breakdown([...maximum.terms, { label: REDUCTION_LABEL, value: -amount }]);
}

/**
 * The hit point maximum the sheet would show with `reduction` held in place of the derived
 * block's. An override replaces every term, a reduction's among them, so it stands as typed.
 */
export function hitPointMaximumUnder(
  derived: Sheet,
  reduction: HitPointMaximumReduction | null,
): number {
  const { computed, manual, terms = [] } = derived.hitPointMaximum;
  if (manual !== null) return manual;
  const unreduced = computed - (terms.find((term) => term.label === REDUCTION_LABEL)?.value ?? 0);
  return unreduced - taken(unreduced, reduction);
}

/**
 * The state holding `reduction`, or none where it is null, with current hit points above the
 * maximum it leaves lowered to that maximum. Clearing a reduction restores no hit points.
 */
export function maximumReducedState(
  derived: Sheet,
  state: CharacterState,
  reduction: HitPointMaximumReduction | null,
): CharacterState {
  const before = hitPointMaximumUnder(derived, state.hitPointMaximumReduction);
  const maximum = hitPointMaximumUnder(derived, reduction);
  const current = state.hitPoints.current ?? before;
  return {
    ...state,
    hitPointMaximumReduction: reduction,
    hitPoints: current > maximum ? { ...state.hitPoints, current: maximum } : state.hitPoints,
  };
}
