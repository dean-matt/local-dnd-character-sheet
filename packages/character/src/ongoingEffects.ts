/** A feature's effect the player starts and ends, held by the feature's name in the state's `activeEffects`. */
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
