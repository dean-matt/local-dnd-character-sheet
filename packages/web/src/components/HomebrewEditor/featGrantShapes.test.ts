import { describe, expect, it } from "vitest";
import {
  BACKGROUND_GRANT_SPECS,
  FEAT_GRANT_SPECS,
  grantProblem,
  readGrant,
  writeGrant,
} from "./featGrantShapes.ts";

const { ability, expertise, weaponProficiencies } = FEAT_GRANT_SPECS;

describe("readGrant", () => {
  it("reads a fixed grant, a list choice and a choice of any, as upstream's feats write them", () => {
    expect(readGrant([{ con: 1 }], ability)).toEqual({
      mode: "fixed",
      names: ["con"],
      amount: 1,
    });
    expect(readGrant([{ choose: { from: ["Insight", "perception"] } }], expertise)).toEqual({
      mode: "list",
      from: ["insight", "perception"],
      count: 1,
    });
    expect(readGrant([{ anyProficientSkill: 1 }], expertise)).toEqual({ mode: "any", count: 1 });
    expect(
      readGrant(
        [{ choose: { from: ["str", "dex", "con", "int", "wis", "cha"], amount: 1 }, max: 30 }],
        ability,
      ),
    ).toEqual({ mode: "any", count: 1 });
  });

  it("leaves alternatives, a mixed grant and a pick of a fixed-only field to the JSON", () => {
    expect(readGrant([{ draconic: true }, { any: 1 }], expertise)).toBeUndefined();
    expect(readGrant([{ perception: true, anyProficientSkill: 1 }], expertise)).toBeUndefined();
    expect(readGrant([{ choose: { fromFilter: "type=martial" } }], weaponProficiencies)).toBe(
      undefined,
    );
    expect(readGrant([{ str: 1, dex: 2 }], ability)).toBeUndefined();
  });
});

describe("writeGrant", () => {
  it("keeps an Epic Boon's max and a choice's amount through an edit", () => {
    const boon = [{ choose: { from: ["str", "dex"], amount: 1 }, max: 30 }];
    expect(writeGrant(boon, ability, { mode: "list", from: ["str", "con"], count: 2 })).toEqual([
      { choose: { from: ["str", "con"], count: 2, amount: 1 }, max: 30 },
    ]);
  });

  it("drops the field for none and for a fixed grant naming nothing", () => {
    expect(writeGrant([{ con: 1 }], ability, { mode: "none" })).toBeUndefined();
    expect(writeGrant(undefined, expertise, { mode: "fixed", names: [], amount: null })).toBe(
      undefined,
    );
  });
});

describe("grantProblem", () => {
  it("names a choice with nothing to choose, too many to pick or no count, and an increase under 1", () => {
    expect(grantProblem([{ choose: { from: [], count: 1 } }], expertise)).toMatch(/at least one/);
    expect(grantProblem([{ choose: { from: ["stealth"], count: 2 } }], expertise)).toMatch(
      /no more than the 1/,
    );
    expect(grantProblem([{ anyProficientSkill: null }], expertise)).toMatch(/at least 1/);
    expect(grantProblem([{ con: null }], ability)).toMatch(/Increase by/);
    expect(grantProblem([{ con: 0 }], ability)).toMatch(/Increase by: .* at least 1/);
    expect(grantProblem([{ con: -2 }], ability)).toMatch(/Increase by/);
    expect(grantProblem([{ con: 1 }], ability)).toBeUndefined();
    expect(grantProblem([{ draconic: true }, { any: 0 }], expertise)).toBeUndefined();
  });
});

describe("a background's weighted ability choice", () => {
  const { ability: backgroundAbility } = BACKGROUND_GRANT_SPECS;
  const from = ["int", "wis", "cha"];
  const weighted = [
    { choose: { weighted: { from, weights: [2, 1] } } },
    { choose: { weighted: { from, weights: [1, 1, 1] } } },
  ];

  it("reads upstream's two alternatives and writes them back unchanged", () => {
    const state = readGrant(weighted, backgroundAbility);
    expect(state).toEqual({ mode: "weighted", from });
    expect(writeGrant(weighted, backgroundAbility, { mode: "weighted", from })).toEqual(weighted);
  });

  it("leaves other weights, mismatched abilities and a feat's field to the JSON", () => {
    expect(readGrant(weighted.slice(0, 1), backgroundAbility)).toBeUndefined();
    expect(
      readGrant(
        [weighted[0], { choose: { weighted: { from: ["str"], weights: [1, 1, 1] } } }],
        backgroundAbility,
      ),
    ).toBeUndefined();
    expect(readGrant(weighted, ability)).toBeUndefined();
  });

  it("names a choice that does not offer exactly three abilities", () => {
    expect(grantProblem(weighted, backgroundAbility)).toBeUndefined();
    expect(
      grantProblem(
        writeGrant(undefined, backgroundAbility, { mode: "weighted", from: ["str"] }),
        backgroundAbility,
      ),
    ).toMatch(/exactly three/);
  });
});
