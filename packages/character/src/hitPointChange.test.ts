import { describe, expect, it } from "vitest";
import {
  damagedState,
  deathSaveRolledState,
  deathSaveStatus,
  defaultCharacterState,
  healedState,
} from "./index.ts";

const sheet = { hitPointMaximum: { computed: 20, manual: 30, terms: [] } };

const state = (current: number | null) => ({
  ...defaultCharacterState(),
  hitPoints: { current, temporary: 0 },
});

describe("damagedState", () => {
  it("kills outright on massive damage past the maximum the sheet shows", () => {
    expect(damagedState({ houseRules: {} }, sheet, state(5), 34).outcome).toBe("dying");
    const { state: after, outcome } = damagedState({ houseRules: {} }, sheet, state(5), 35);
    expect(outcome).toBe("dead");
    expect(after.deathSaves).toEqual({ successes: 0, failures: 3 });
  });

  it("leaves massive damage dying under noInstantDeath", () => {
    const rules = { houseRules: { noInstantDeath: true } };
    const { state: after, outcome } = damagedState(rules, sheet, state(5), 35);
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

const dying = (successes: number, failures: number) => ({
  ...state(0),
  deathSaves: { successes, failures },
});

describe("deathSaveStatus", () => {
  it.each([
    [state(1), undefined],
    [dying(2, 2), "dying"],
    [dying(3, 0), "stable"],
    [dying(0, 3), "dead"],
    [dying(3, 3), "dead"],
  ])("reads %j as %s", (at, status) => {
    expect(deathSaveStatus(sheet, at)).toBe(status);
  });
});

describe("deathSaveRolledState", () => {
  it.each([
    [10, { successes: 1, failures: 0 }, "dying"],
    [9, { successes: 0, failures: 1 }, "dying"],
    [1, { successes: 0, failures: 2 }, "dying"],
  ])("records a %i as %j", (roll, deathSaves, outcome) => {
    expect(deathSaveRolledState(sheet, dying(0, 0), roll)).toEqual({
      state: dying(deathSaves.successes, deathSaves.failures),
      outcome,
    });
  });

  it("stores the third success as three, where deathSave clears both counts", () => {
    const { state: after, outcome } = deathSaveRolledState(sheet, dying(2, 2), 15);
    expect(outcome).toBe("stable");
    expect(after.deathSaves).toEqual({ successes: 3, failures: 0 });
  });

  it("brings a 20 up to 1 hit point with both counts cleared", () => {
    const { state: after, outcome } = deathSaveRolledState(sheet, dying(1, 2), 20);
    expect(outcome).toBe("conscious");
    expect(after.hitPoints.current).toBe(1);
    expect(after.deathSaves).toEqual({ successes: 0, failures: 0 });
  });

  it("writes null for a 20 when the maximum is 1", () => {
    const one = { hitPointMaximum: { computed: 1, manual: null, terms: [] } };
    expect(deathSaveRolledState(one, dying(0, 0), 20).state.hitPoints.current).toBeNull();
  });
});
