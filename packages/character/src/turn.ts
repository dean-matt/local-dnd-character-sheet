import { type CharacterState, TURN_AVAILABLE, type TurnMark } from "./state.ts";

export const TURN_LABELS: Record<TurnMark, string> = {
  action: "Action",
  bonusAction: "Bonus action",
  reaction: "Reaction",
  movement: "Movement",
};

/** The state with `mark` flipped between spent and available. */
export const turnMarkToggled = (state: CharacterState, mark: TurnMark): CharacterState => ({
  ...state,
  turn: { ...state.turn, [mark]: !state.turn[mark] },
});

/** The state with every mark available. */
export const turnReset = (state: CharacterState): CharacterState => ({
  ...state,
  turn: TURN_AVAILABLE,
});

/**
 * The state with `mark` spent, however it stood. With the action already spent, it spends the
 * first action a feature added that is still available.
 */
export function turnMarkSpent(state: CharacterState, mark: TurnMark): CharacterState {
  if (!state.turn[mark]) return { ...state, turn: { ...state.turn, [mark]: true } };
  const added = state.turn.addedActions.indexOf(false);
  return mark !== "action" || added < 0 ? state : addedActionToggled(state, added);
}

/** The state with one more action available this turn, as Action Surge gives. */
export const actionAdded = (state: CharacterState): CharacterState => ({
  ...state,
  turn: { ...state.turn, addedActions: [...state.turn.addedActions, false] },
});

/** The state with the added action at `index` flipped between spent and available. */
export const addedActionToggled = (state: CharacterState, index: number): CharacterState => ({
  ...state,
  turn: {
    ...state.turn,
    addedActions: state.turn.addedActions.map((spent, at) => (at === index ? !spent : spent)),
  },
});

/** Whether a once-a-turn feature is used this turn; outside an encounter no turn is tracked, so never. */
export const usedThisTurn = (state: CharacterState, feature: string): boolean =>
  state.encounter !== null && state.turn.features.includes(feature);

/** The state with each once-a-turn feature of `features` used, recorded only while an encounter tracks turns. */
export const featuresUsed = (
  state: CharacterState,
  features: readonly string[],
): CharacterState => {
  const fresh = features.filter((feature) => !state.turn.features.includes(feature));
  return state.encounter === null || fresh.length === 0
    ? state
    : { ...state, turn: { ...state.turn, features: [...state.turn.features, ...fresh] } };
};
