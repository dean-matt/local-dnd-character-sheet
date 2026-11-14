import { describe, expect, it } from "vitest";
import {
  characterStateSchema,
  describeStateChange,
  TURN_MARKS,
  turnMarkSpent,
  turnMarkToggled,
  turnReset,
} from "./index.ts";
import { state } from "./test/vex.ts";

describe("turn marks", () => {
  it("toggles one mark and leaves the rest", () => {
    const spent = turnMarkToggled(state, "reaction");
    expect(spent.turn).toEqual({
      action: false,
      bonusAction: false,
      reaction: true,
      movement: false,
    });
    expect(turnMarkToggled(spent, "reaction").turn).toEqual(state.turn);
  });

  it("spends a mark and leaves a spent one as it was", () => {
    const spent = turnMarkSpent(state, "bonusAction");
    expect(spent.turn.bonusAction).toBe(true);
    expect(turnMarkSpent(spent, "bonusAction")).toBe(spent);
  });

  it("resets every mark", () => {
    const all = TURN_MARKS.reduce(turnMarkToggled, state);
    expect(turnReset(all).turn).toEqual(state.turn);
  });

  it("reads a state stored before turn marks as all available", () => {
    const { turn: _turn, ...stored } = state;
    expect(characterStateSchema.parse(stored).turn).toEqual(state.turn);
  });

  it("describes a spent mark", () => {
    expect(describeStateChange(state, turnMarkToggled(state, "bonusAction"))).toContain(
      "Bonus action",
    );
  });
});
