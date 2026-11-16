import { type Breakdown, breakdown, resets, type Term } from "@dnd/rules";
import type { Speed } from "./characterDerived.ts";
import type { TermReference } from "./derivedField.ts";
import { refKey } from "./keys.ts";
import type { CharacterState, TemporaryModifier } from "./state.ts";

type Target = TemporaryModifier["target"];
type Held = Pick<CharacterState, "temporaryModifiers">;

/** One term per held modifier that moves the value `matches` names, in the order they were added. */
export function modifierTerms(
  { temporaryModifiers }: Held,
  matches: (target: Target) => boolean,
): Term<TermReference>[] {
  return temporaryModifiers
    .filter(({ target }) => matches(target))
    .map(({ name, amount }) => ({ label: name, value: amount }));
}

export const onSkill = (skill: { name: string; source: string }) => (target: Target) =>
  target.kind === "skill" && refKey(target.ref) === refKey(skill);

export const onSave = (ability: string) => (target: Target) =>
  target.kind === "save" && target.ability === ability;

export const onKind = (kind: Target["kind"]) => (target: Target) => target.kind === kind;

/**
 * `maximum` with each of `modifiers` as a term, none taking it below 1: a reduction to 0
 * kills, which the sheet leaves to the player.
 */
export function withModifiers(
  maximum: Breakdown<TermReference>,
  modifiers: readonly Term<TermReference>[],
): Breakdown<TermReference> {
  let total = maximum.total;
  const terms = [...maximum.terms];
  for (const modifier of modifiers) {
    const value = Math.max(modifier.value, 1 - total);
    if (value === 0) continue;
    total += value;
    terms.push({ ...modifier, value });
  }
  return breakdown(terms);
}

/**
 * `speed` with each speed modifier added to every mode the character has, one term per mode
 * it moved. A mode never falls below 0.
 */
export function speedWithModifiers(
  speed: Speed,
  held: Held,
): { speed: Speed; terms: Term<TermReference>[] } {
  const moved: Speed = { ...speed };
  const terms: Term<TermReference>[] = [];
  for (const { name, amount } of held.temporaryModifiers.filter(
    ({ target }) => target.kind === "speed",
  )) {
    for (const mode of Object.keys(moved) as (keyof Speed)[]) {
      const before = moved[mode] ?? 0;
      const after = Math.max(0, before + amount);
      if (after === before) continue;
      moved[mode] = after;
      terms.push({ label: `${name}: ${mode} ${before} to ${after}`, value: after - before });
    }
  }
  return { speed: moved, terms };
}

/** The state with each modifier a rest of `length` meets removed. */
export function modifiersEnded(state: CharacterState, length: "short" | "long"): CharacterState {
  return {
    ...state,
    temporaryModifiers: state.temporaryModifiers.filter(
      ({ endsOn }) => endsOn === null || !resets(endsOn, length),
    ),
  };
}
