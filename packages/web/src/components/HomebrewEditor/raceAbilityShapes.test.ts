import { describe, expect, it } from "vitest";
import { raceAbilityProblem, readRaceAbility, writeRaceAbility } from "./raceAbilityShapes.ts";

describe("readRaceAbility", () => {
  it("reads fixed amounts per ability, a negative one included", () => {
    expect(readRaceAbility([{ dex: 2, cha: 1, str: -2 }])).toEqual({
      mode: "fixed",
      amounts: { dex: 2, cha: 1, str: -2 },
    });
    expect(readRaceAbility(undefined)).toEqual({ mode: "none" });
  });

  it("reads a choose from a list, with its defaults", () => {
    expect(readRaceAbility([{ choose: { from: ["str", "dex"] } }])).toEqual({
      mode: "choose",
      from: ["str", "dex"],
      count: 1,
      amount: 1,
    });
  });

  it("leaves alternatives, a weighted pick and a mix to the JSON", () => {
    expect(readRaceAbility([{ dex: 2 }, { str: 2 }])).toBeUndefined();
    expect(readRaceAbility([{ choose: { weighted: { from: ["int"], weights: [2] } } }])).toBe(
      undefined,
    );
    expect(readRaceAbility([{ dex: 2, choose: { from: ["str"] } }])).toBeUndefined();
  });
});

describe("writeRaceAbility", () => {
  it("writes the raised abilities as one alternative and nothing for none", () => {
    expect(writeRaceAbility({ mode: "fixed", amounts: { dex: 2, str: 0 } })).toEqual([{ dex: 2 }]);
    expect(writeRaceAbility({ mode: "fixed", amounts: {} })).toBeUndefined();
    expect(writeRaceAbility({ mode: "none" })).toBeUndefined();
  });

  it("writes a choose with its amount only when it is not 1", () => {
    expect(writeRaceAbility({ mode: "choose", from: ["str", "dex"], count: 2, amount: 1 })).toEqual(
      [{ choose: { from: ["str", "dex"], count: 2 } }],
    );
    expect(writeRaceAbility({ mode: "choose", from: ["str"], count: 1, amount: 2 })).toEqual([
      { choose: { from: ["str"], count: 1, amount: 2 } },
    ]);
  });
});

describe("raceAbilityProblem", () => {
  it("names the input of a choose that cannot be met", () => {
    const choose = (choice: object) => raceAbilityProblem([{ choose: choice }]);
    expect(choose({ from: [] })).toBe("Pick at least one to choose from");
    expect(choose({ from: ["str"], count: null })).toMatch(/^How many:/);
    expect(choose({ from: ["str"], count: 2 })).toBe("How many: no more than the 1 to choose from");
    expect(choose({ from: ["str"], amount: 0 })).toMatch(/^Increase by:/);
    expect(choose({ from: ["str", "dex"], count: 2 })).toBeUndefined();
  });

  it("finds nothing wrong with a shape it leaves to the JSON", () => {
    expect(raceAbilityProblem([{ dex: 2 }, { str: 2 }])).toBeUndefined();
  });
});
