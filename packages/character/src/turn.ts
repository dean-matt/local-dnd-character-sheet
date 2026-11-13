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
