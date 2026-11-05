import { describe, expect, it } from "vitest";
import { damagedState, defaultCharacterState, healedState } from "./index.ts";

const sheet = { hitPointMaximum: { computed: 20, manual: 30, terms: [] } };

const state = (current: number | null) => ({
  ...defaultCharacterState(),
  hitPoints: { current, temporary: 0 },
});

describe("damagedState", () => {
  it("kills outright on massive damage past the maximum the sheet shows", () => {
    expect(damagedState({ houseRules: {} }, sheet, state(5), 34, false).outcome).toBe("dying");
    const { state: after, outcome } = damagedState({ houseRules: {} }, sheet, state(5), 35, false);
    expect(outcome).toBe("dead");
    expect(after.deathSaves).toEqual({ successes: 0, failures: 3 });
  });

  it("leaves massive damage dying under noInstantDeath", () => {
    const rules = { houseRules: { noInstantDeath: true } };
    const { state: after, outcome } = damagedState(rules, sheet, state(5), 35, false);
    expect(outcome).toBe("dying");
    expect(after.hitPoints).toEqual({ current: 0, temporary: 0 });
  });
});

describe("healedState", () => {
  it("heals up to the maximum the sheet shows", () => {
    expect(healedState(sheet, state(5), 24).state.hitPoints.current).toBe(29);
    expect(healedState(sheet, state(5), 25).state.hitPoints.current).toBeNull();
  });
});
