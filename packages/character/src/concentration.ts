import type { CharacterState, Concentration } from "./state.ts";

/**
 * The state holding `concentration`, and the concentration that ended to make room, or null
 * where none was held. Starting never refuses: a caster may drop one spell for another.
 */
export const concentrationStarted = (state: CharacterState, concentration: Concentration) => ({
  state: { ...state, concentration },
  ended: state.concentration,
});

/** The state with no concentration held and nothing else changed, whatever broke it. */
export const concentrationEnded = (state: CharacterState): CharacterState => ({
  ...state,
  concentration: null,
});
