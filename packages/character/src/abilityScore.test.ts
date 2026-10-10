import { describe, expect, it } from "vitest";
import type { AbilityGrant } from "./abilityScore.ts";
import { abilityScore, abilityScoreBreakdown, type CharacterDefinition } from "./index.ts";

const abilityScores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };

describe("abilityScoreBreakdown", () => {
  it("states the base and each increase as its own term", () => {
    const abilityIncreases: CharacterDefinition["abilityIncreases"] = [
      { ability: "str", amount: 2, grantedBy: "background" },
      { ability: "dex", amount: 1, grantedBy: "background" },
      { ability: "str", amount: -2, grantedBy: "race" },
    ];
    expect(abilityScoreBreakdown({ abilityScores, abilityIncreases }, "str")).toEqual({
      total: 15,
      terms: [
        { label: "Base", value: 15 },
        { label: "Background", value: 2 },
        { label: "Race", value: -2 },
      ],
    });
  });

  it("is the base alone where nothing raises the score", () => {
    expect(abilityScore({ abilityScores, abilityIncreases: [] }, "cha")).toBe(8);
  });
});

describe("abilityScoreBreakdown with item grants", () => {
  const abilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const score = (grants: AbilityGrant[]) =>
    abilityScoreBreakdown({ abilityScores, abilityIncreases: [] }, "str", grants);

  it("adds a bonus, stopping at the item's cap without lowering a score past it", () => {
    const manual = { name: "Manual", static: {}, bonus: { str: 4 }, max: 12 };
    expect(score([manual]).total).toBe(12);
    expect(
      abilityScoreBreakdown(
        { abilityScores: { ...abilityScores, str: 15 }, abilityIncreases: [] },
        "str",
        [manual],
      ).terms,
    ).toEqual([{ label: "Base", value: 15 }]);
  });

  it("compares a static score with the total the bonuses reached", () => {
    const tome = { name: "Tome", static: {}, bonus: { str: 2 } };
    const belt = { name: "Belt", static: { str: 21 }, bonus: {} };
    expect(score([belt, tome]).terms).toEqual([
      { label: "Base", value: 10 },
      { label: "Tome", value: 2 },
      { label: "Belt", value: 9 },
    ]);
  });

  it("takes the higher of two static scores", () => {
    const grants = [
      { name: "Hill", static: { str: 21 }, bonus: {} },
      { name: "Frost", static: { str: 23 }, bonus: {} },
    ];
    expect(score(grants).total).toBe(23);
    expect(score(grants.reverse()).total).toBe(23);
  });

  it("subtracts a penalty whatever the cap", () => {
    expect(score([{ name: "Curse", static: {}, bonus: { str: -2 }, max: 12 }]).total).toBe(8);
  });
});
