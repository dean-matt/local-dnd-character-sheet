import { describe, expect, it } from "vitest";
import {
  damagedState,
  deathSaveRolledState,
  deathSaveStatus,
  defaultCharacterState,
  healedState,
  hitDieSpentState,
} from "./index.ts";

const sheet = { hitPointMaximum: { computed: 20, manual: 30, terms: [] } };

const grant = (name: string, from: string) => ({ name, from: [from] });

const defended = {
  ...sheet,
  defenses: {
    computed: {
      resistances: [grant("slashing", "Rage"), grant("fire", "Tiefling")],
      damageImmunities: [grant("fire", "Ring of Fire Immunity")],
      conditionImmunities: [],
      vulnerabilities: [grant("cold", "Curse"), grant("slashing", "Curse")],
      resistanceChoice: null,
    },
    manual: null,
    terms: [],
  },
};

const unhurt = {
  houseRules: {},
  addedDefenses: {
    resistances: ["acid"],
    damageImmunities: ["poison"],
    conditionImmunities: ["poison"],
  },
};

const state = (current: number | null) => ({
  ...defaultCharacterState(),
  hitPoints: { current, temporary: 0 },
});

describe("damagedState", () => {
  it.each([
    [undefined, 11, []],
    ["slashing", 10, ["resistance", "vulnerability"]],
    ["fire", 0, ["immunity"]],
    ["cold", 22, ["vulnerability"]],
    ["acid", 5, ["resistance"]],
    ["poison", 0, ["immunity"]],
    ["thunder", 11, []],
  ])("meets %s damage with the defenses the sheet shows", (type, amount, applied) => {
    const after = damagedState(unhurt, defended, state(null), 11, type);
    expect(after).toMatchObject({ amount, applied });
    expect(after.state.hitPoints.current).toBe(amount === 0 ? null : 30 - amount);
  });

  it("lets temporary hit points absorb the adjusted amount", () => {
    const held = { ...state(30), hitPoints: { current: 30, temporary: 4 } };
    expect(damagedState(unhurt, defended, held, 11, "acid").state.hitPoints).toEqual({
      current: 29,
      temporary: 0,
    });
  });

  it("kills outright on massive damage past the maximum the sheet shows", () => {
    expect(damagedState(unhurt, defended, state(5), 34).outcome).toBe("dying");
    const { state: after, outcome } = damagedState(unhurt, defended, state(5), 35);
    expect(outcome).toBe("dead");
    expect(after.deathSaves).toEqual({ successes: 0, failures: 3 });
  });

  it("leaves massive damage dying under noInstantDeath", () => {
    const rules = { ...unhurt, houseRules: { noInstantDeath: true } };
    const { state: after, outcome } = damagedState(rules, defended, state(5), 35);
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

describe("hitDieSpentState", () => {
  const total = (computed: number) => ({ computed, manual: null, terms: [] });
  const con = (modifier: number) => ({
    ...sheet,
    hitDice: [
      { die: 8 as const, total: total(3) },
      { die: 6 as const, total: total(1) },
    ],
    spellSlots: [],
    pactSlots: null,
    classResources: [],
    abilityModifiers: { con: total(modifier) } as never,
  });
  const held = (current: number | null, d8 = 2) => ({
    ...state(current),
    hitDice: [
      { die: 8 as const, total: 3, remaining: d8 },
      { die: 6 as const, total: 1, remaining: 1 },
    ],
  });

  it("heals the roll plus the modifier and lowers that pool by one", () => {
    const spent = hitDieSpentState({ edition: "classic" }, con(2), held(10), 8, 5);
    expect(spent?.regained).toBe(7);
    expect(spent?.state.hitPoints.current).toBe(17);
    expect(spent?.state.hitDice.map((pool) => pool.remaining)).toEqual([1, 1]);
  });

  it("floors at 0 for classic and 1 for 2024", () => {
    expect(hitDieSpentState({ edition: "classic" }, con(-4), held(10), 8, 2)?.regained).toBe(0);
    expect(hitDieSpentState({ edition: "one" }, con(-4), held(10), 8, 2)?.regained).toBe(1);
  });

  it("stops at the maximum and keeps temporary hit points", () => {
    const padded = { ...held(28), hitPoints: { current: 28, temporary: 3 } };
    const spent = hitDieSpentState({ edition: "classic" }, con(2), padded, 8, 8);
    expect(spent?.state.hitPoints).toEqual({ current: null, temporary: 3 });
  });

  it("clears the death saves when it heals from 0", () => {
    const dying = { ...held(0), deathSaves: { successes: 1, failures: 2 } };
    const spent = hitDieSpentState({ edition: "classic" }, con(2), dying, 8, 3);
    expect(spent?.state.deathSaves).toEqual({ successes: 0, failures: 0 });
  });

  it("spends nothing at maximum hit points", () => {
    expect(hitDieSpentState({ edition: "classic" }, con(2), held(null), 8, 5)).toBeUndefined();
    expect(hitDieSpentState({ edition: "classic" }, con(2), held(30), 8, 5)).toBeUndefined();
  });

  it("spends nothing from an empty pool, an unknown size or a dead character", () => {
    expect(hitDieSpentState({ edition: "classic" }, con(2), held(10, 0), 8, 5)).toBeUndefined();
    expect(hitDieSpentState({ edition: "classic" }, con(2), held(10), 12, 5)).toBeUndefined();
    const dead = { ...held(0), deathSaves: { successes: 0, failures: 3 } };
    expect(hitDieSpentState({ edition: "classic" }, con(2), dead, 8, 5)).toBeUndefined();
  });
});
