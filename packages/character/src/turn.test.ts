import { describe, expect, it } from "vitest";
import {
  actionAdded,
  addedActionToggled,
  characterStateSchema,
  describeStateChange,
  featuresUsed,
  TURN_MARKS,
  turnMarkSpent,
  turnMarkToggled,
  turnReset,
  usedThisTurn,
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
      addedActions: [],
      features: [],
    });
    expect(turnMarkToggled(spent, "reaction").turn).toEqual(state.turn);
  });

  it("spends a mark and leaves a spent one as it was", () => {
    const spent = turnMarkSpent(state, "bonusAction");
    expect(spent.turn.bonusAction).toBe(true);
    expect(turnMarkSpent(spent, "bonusAction")).toBe(spent);
  });

  it("spends an added action once the turn's own action is spent", () => {
    const surged = actionAdded(turnMarkSpent(state, "action"), "Action Surge");
    expect(surged.turn.addedActions).toEqual([false]);
    const spent = turnMarkSpent(surged, "action");
    expect(spent.turn.addedActions).toEqual([true]);
    expect(turnMarkSpent(spent, "action")).toBe(spent);
    expect(addedActionToggled(spent, 0).turn.addedActions).toEqual([false]);
  });

  it("keeps an action added before the turn's own is spent", () => {
    const spent = turnMarkSpent(actionAdded(state, "Action Surge"), "action");
    expect(spent.turn).toMatchObject({ action: true, addedActions: [false] });
  });

  it("adds a feature's action once a turn, however many uses it has", () => {
    const surged = actionAdded(state, "Action Surge");
    expect(actionAdded(surged, "Action Surge")).toBe(surged);
    expect(surged.turn.addedActions).toEqual([false]);
    expect(actionAdded(turnReset(surged), "Action Surge").turn.addedActions).toEqual([false]);
  });

  it("drops the added actions when the turn resets", () => {
    expect(turnReset(actionAdded(state, "Action Surge")).turn.addedActions).toEqual([]);
  });

  it("describes an added action", () => {
    expect(describeStateChange(state, actionAdded(state, "Action Surge"))).toBe(
      "Added actions set to 0 of 1 spent, Used this turn set to Action Surge",
    );
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

describe("once-a-turn features", () => {
  const fighting = { ...state, encounter: { round: 1, initiative: null } };

  it("records a use while an encounter runs, until the turn resets", () => {
    const used = featuresUsed(fighting, ["Sneak Attack"]);
    expect(usedThisTurn(used, "Sneak Attack")).toBe(true);
    expect(featuresUsed(used, ["Sneak Attack"])).toBe(used);
    expect(usedThisTurn(turnReset(used), "Sneak Attack")).toBe(false);
  });

  it("records nothing outside an encounter, which tracks no turn", () => {
    expect(featuresUsed(state, ["Sneak Attack"])).toBe(state);
    expect(usedThisTurn(state, "Sneak Attack")).toBe(false);
  });

  it("names the features used in the change it describes", () => {
    const used = featuresUsed(fighting, ["Sneak Attack", "Divine Strike"]);
    expect(describeStateChange(fighting, used)).toBe(
      "Used this turn set to Sneak Attack, Divine Strike",
    );
  });
});
