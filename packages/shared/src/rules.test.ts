import { describe, expect, it } from "vitest";
import { abilityModifier, proficiencyBonus, spellAttackBonus, spellSaveDc } from "./rules.ts";

describe("abilityModifier", () => {
  it.each([
    [1, -5],
    [8, -1],
    [10, 0],
    [11, 0],
    [16, 3],
    [20, 5],
    [30, 10],
  ])("score %i gives %i", (score, expected) => {
    expect(abilityModifier(score)).toBe(expected);
  });
});

describe("proficiencyBonus", () => {
  it.each([
    [1, 2],
    [4, 2],
    [5, 3],
    [9, 4],
    [13, 5],
    [17, 6],
    [20, 6],
  ])("level %i gives +%i", (level, expected) => {
    expect(proficiencyBonus(level)).toBe(expected);
  });

  it.each([0, 21, -1])("rejects level %i", (level) => {
    expect(() => proficiencyBonus(level)).toThrow(RangeError);
  });
});

describe("spell math", () => {
  it("derives save DC from proficiency and modifier", () => {
    expect(spellSaveDc(4, 5)).toBe(15);
  });

  it("derives attack bonus from proficiency and modifier", () => {
    expect(spellAttackBonus(4, 5)).toBe(7);
  });
});
