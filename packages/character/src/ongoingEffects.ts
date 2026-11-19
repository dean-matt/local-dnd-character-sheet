/** A feature's effect the player starts and ends, held by the feature's name in the state's `activeEffects`. */
import type { EffectEnd } from "./featureMechanics.ts";
import type { CharacterState } from "./state.ts";

type Effects = Pick<CharacterState, "activeEffects">;

export const effectRunning = (state: Effects, name: string) =>
  state.activeEffects.some((effect) => effect.name === name);

/** The state with the effect begun; a running one is unchanged. */
export const effectStarted = <S extends Effects>(state: S, name: string): S =>
  effectRunning(state, name)
    ? state
    : { ...state, activeEffects: [...state.activeEffects, { name }] };

/** The state with the effect ended and nothing it spent restored. */
export const effectEnded = <S extends Effects>(state: S, name: string): S => ({
  ...state,
  activeEffects: state.activeEffects.filter((effect) => effect.name !== name),
});

/** The state with each running effect of `startable` that `cause` ends early ended. */
export const effectsEndedBy = <S extends Effects>(
  state: S,
  startable: readonly { name: string; endsOn: readonly EffectEnd[] }[],
  cause: EffectEnd,
): S =>
  startable.reduce(
    (ending, { name, endsOn }) => (endsOn.includes(cause) ? effectEnded(ending, name) : ending),
    state,
  );

const WORN: Partial<Record<EffectEnd, string>> = {
  medium: "Medium armor is worn.",
  heavy: "Heavy armor is worn.",
  shield: "A shield is equipped.",
};

/** Why an effect that `endsOn` ends cannot start in the armor categories `worn`, or null where it can. */
export function effectBlockedBy(
  endsOn: readonly EffectEnd[],
  worn: readonly (string | undefined)[],
): string | null {
  const blocking = endsOn.find((end) => worn.includes(end));
  return blocking ? (WORN[blocking] ?? null) : null;
}
