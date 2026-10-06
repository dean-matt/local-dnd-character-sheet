import { describe, expect, it } from "vitest";
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
