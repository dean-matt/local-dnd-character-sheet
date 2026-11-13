import { type CharacterState, MAX_ROUND } from "./state.ts";
import { turnReset } from "./turn.ts";

/**
 * The state holding `initiative`: an encounter already running keeps its round, and none
 * running starts at round 1.
 */
export const initiativeRolled = (state: CharacterState, initiative: number): CharacterState => ({
  ...state,
  encounter: { round: state.encounter?.round ?? 1, initiative },
});

/** The state in round 1 of a new encounter with no initiative rolled. */
export const encounterStarted = (state: CharacterState): CharacterState => ({
  ...state,
  encounter: { round: 1, initiative: null },
});

/** The state one round on with every turn mark available, or as given where no encounter runs or the last round is reached. */
export function roundAdvanced(state: CharacterState): CharacterState {
  const { encounter } = state;
  if (!encounter || encounter.round >= MAX_ROUND) return state;
  return turnReset({ ...state, encounter: { ...encounter, round: encounter.round + 1 } });
}

/** The state with no encounter, and the round concentration began in forgotten with it. */
export function encounterEnded(state: CharacterState): CharacterState {
  const { concentration } = state;
  if (!concentration) return { ...state, encounter: null };
  const { round: _round, ...held } = concentration;
  return { ...state, concentration: held, encounter: null };
}
