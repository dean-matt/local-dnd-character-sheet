import { type Breakdown, breakdown } from "@dnd/rules";
import type { CharacterDerived } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import type { Derived, TermReference } from "./derivedField.ts";
import { derivedValue } from "./resolve.ts";
import type { CharacterState, HitPointMaximumReduction } from "./state.ts";

/** The label of the term a reduction adds to the hit point maximum's breakdown. */
const REDUCTION_LABEL = "Maximum reduction";

type Sheet = Pick<CharacterDerived, "hitPointMaximum">;
type Overrides = Pick<CharacterDefinition, "overrides">;

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

/** The folded hit point maximum with `reduction` taken from its override too, where one is held. */
export function reducedOverride(
  field: CharacterDerived["hitPointMaximum"],
  reduction: HitPointMaximumReduction | null,
): CharacterDerived["hitPointMaximum"] {
  const { manual } = field;
  return manual === null ? field : { ...field, manual: manual - taken(manual, reduction) };
}

/**
 * The hit point maximum before any reduction: the computed total and terms less the reduction's
 * term, and the override the definition holds, read from the definition rather than the derived
 * block so it stays current while the derived block reloads after an edit. An override the
 * derived schema refuses, which the derived block drops, reads as none.
 */
export function maximumBeforeReduction(definition: Overrides, derived: Sheet): Derived<number> {
  const { computed, terms = [] } = derived.hitPointMaximum;
  const typed = definition.overrides.hitPointMaximum;
  return {
    computed: computed - (terms.find((term) => term.label === REDUCTION_LABEL)?.value ?? 0),
    manual: typeof typed === "number" && Number.isInteger(typed) && typed >= 1 ? typed : null,
    terms: terms.filter((term) => term.label !== REDUCTION_LABEL),
  };
}

/** The hit point maximum the sheet would show with `reduction` held in place of the derived block's. */
export function hitPointMaximumUnder(
  definition: Overrides,
  derived: Sheet,
  reduction: HitPointMaximumReduction | null,
): number {
  const unreduced = derivedValue(maximumBeforeReduction(definition, derived));
  return unreduced - taken(unreduced, reduction);
}

/**
 * The state holding `reduction`, or none where it is null, with current hit points above the
 * maximum it leaves lowered to that maximum. Clearing a reduction restores no hit points.
 */
export function maximumReducedState(
  definition: Overrides,
  derived: Sheet,
  state: CharacterState,
  reduction: HitPointMaximumReduction | null,
): CharacterState {
  const before = hitPointMaximumUnder(definition, derived, state.hitPointMaximumReduction);
  const maximum = hitPointMaximumUnder(definition, derived, reduction);
  const current = state.hitPoints.current ?? before;
  return {
    ...state,
    hitPointMaximumReduction: reduction,
    hitPoints: current > maximum ? { ...state.hitPoints, current: maximum } : state.hitPoints,
  };
}
