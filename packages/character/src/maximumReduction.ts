import { type Breakdown, breakdown, type Term } from "@dnd/rules";
import type { CharacterDerived } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import type { TermReference } from "./derivedField.ts";
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
 * The maximum before any reduction: the override as typed where the derived block applied one,
 * otherwise the computed total less the reduction's term.
 */
function unreducedMaximum(definition: Overrides, derived: Sheet): number {
  const { computed, manual, terms = [] } = derived.hitPointMaximum;
  if (manual !== null) return Number(definition.overrides.hitPointMaximum);
  return computed - (terms.find((term) => term.label === REDUCTION_LABEL)?.value ?? 0);
}

/** An override as typed and the terms the sheet takes from it, for a breakdown that names both. */
export type OverrideReduction = { typed: number; terms: Term<TermReference>[] };

/** The override and the reduction's term over it, where a held reduction lowers an override. */
export function overrideReduction(
  definition: Overrides,
  derived: Sheet,
): OverrideReduction | undefined {
  const { manual } = derived.hitPointMaximum;
  if (manual === null) return undefined;
  const typed = unreducedMaximum(definition, derived);
  return typed === manual
    ? undefined
    : { typed, terms: [{ label: REDUCTION_LABEL, value: manual - typed }] };
}

/** The hit point maximum the sheet would show with `reduction` held in place of the derived block's. */
export function hitPointMaximumUnder(
  definition: Overrides,
  derived: Sheet,
  reduction: HitPointMaximumReduction | null,
): number {
  const unreduced = unreducedMaximum(definition, derived);
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
