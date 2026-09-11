import { describe, expect, it } from "vitest";
import { abilityModifier, passiveScore, proficiencyBonus } from "./core.ts";

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

describe("passiveScore", () => {
  it.each([
    [2, 2, 14],
    [0, 0, 10],
    [-1, 0, 9],
  ])("a modifier of %i and proficiency of %i gives %i", (modifier, proficiency, expected) => {
    expect(passiveScore(modifier, proficiency)).toBe(expected);
  });

  it("doubles for expertise without a second function", () => {
    expect(passiveScore(2, proficiencyBonus(1) * 2)).toBe(16);
  });

  it("rounds half of an odd proficiency bonus down", () => {
    expect(passiveScore(2, proficiencyBonus(5) / 2)).toBe(13);
  });
});
