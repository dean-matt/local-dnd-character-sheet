import type { CharacterDerived } from "./characterDerived.ts";
import { type CharacterState, featureUsesSpent, MAX_ROUND, withFeatureUse } from "./state.ts";
import { turnReset } from "./turn.ts";

/**
 * The state holding `initiative`: an encounter already running keeps its round, and none
 * running starts at round 1.
 */
export const initiativeRolled = (state: CharacterState, initiative: number): CharacterState => ({
  ...state,
  encounter: { round: state.encounter?.round ?? 1, initiative },
});

/** The state with each use a roll of initiative restores, where all its uses are spent. */
export const initiativeRestored = (
  derived: Pick<CharacterDerived, "limitedUses">,
  state: CharacterState,
): CharacterState =>
  derived.limitedUses
    .filter(({ restoredBy }) => restoredBy === "initiative")
    .reduce(
      (into, { key, count }) =>
        featureUsesSpent(into, key, count) >= count ? withFeatureUse(into, key, 0) : into,
      state,
    );

/** The state in round 1 of a new encounter with no initiative rolled, no once-a-turn feature used and no action added. */
export const encounterStarted = (state: CharacterState): CharacterState => ({
  ...state,
  encounter: { round: 1, initiative: null },
  turn: { ...state.turn, features: [], addedActions: [] },
});

/** The state one round on with every turn mark available, or as given where no encounter runs or the last round is reached. */
export function roundAdvanced(state: CharacterState): CharacterState {
  const { encounter } = state;
  if (!encounter || encounter.round >= MAX_ROUND) return state;
  return turnReset({ ...state, encounter: { ...encounter, round: encounter.round + 1 } });
}

/** The state with no encounter, and the round concentration began in forgotten with it, as are the once-a-turn features used and the actions they added. */
export function encounterEnded(state: CharacterState): CharacterState {
  const { concentration } = state;
  const ended = {
    ...state,
    encounter: null,
    turn: { ...state.turn, features: [], addedActions: [] },
  };
  if (!concentration) return ended;
  const { round: _round, ...held } = concentration;
  return { ...ended, concentration: held };
}
