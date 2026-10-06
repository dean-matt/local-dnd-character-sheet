import { describe, expect, it } from "vitest";
import { challengeRatingValue, creatureProficiencyBonus } from "./index.ts";

describe("challengeRatingValue", () => {
  it.each([
    ["0", 0],
    ["1/8", 0.125],
    ["1/2", 0.5],
    ["30", 30],
  ])("reads %s as %d", (rating, value) => {
    expect(challengeRatingValue(rating)).toBe(value);
  });

  it("reads anything else as NaN", () => {
    expect(challengeRatingValue("Unknown")).toBeNaN();
  });
});

describe("creatureProficiencyBonus", () => {
  it.each([
    [0, 2],
    [0.25, 2],
    [4, 2],
    [5, 3],
    [12, 4],
    [13, 5],
    [24, 7],
    [25, 8],
    [30, 9],
  ])("gives a rating of %d a bonus of +%i", (rating, bonus) => {
    expect(creatureProficiencyBonus(rating)).toBe(bonus);
  });
});
