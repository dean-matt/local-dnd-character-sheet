import { describe, expect, it } from "vitest";
import { EDITIONS, exhaustionEffects } from "./index.ts";

describe("exhaustionEffects", () => {
  it.each([
    [0, false, false, false, false, false, false],
    [1, true, false, false, false, false, false],
    [2, true, true, false, false, false, false],
    [3, true, true, true, false, false, false],
    [4, true, true, true, true, false, false],
    [5, true, true, true, true, true, false],
    [6, true, true, true, true, true, true],
  ])(
    "walks the 2014 table at level %i",
    (level, abilityCheckDisadvantage, speedHalved, attackAndSaveDisadvantage, hitPointMaximumHalved, speedZero, dead) => {
      expect(exhaustionEffects(level, "classic")).toEqual({
        edition: "classic",
        abilityCheckDisadvantage,
        speedHalved,
        attackAndSaveDisadvantage,
        hitPointMaximumHalved,
        speedZero,
        dead,
      });
    },
  );

  it.each([
    [0, 0, 0, false],
    [1, 2, 5, false],
    [2, 4, 10, false],
    [3, 6, 15, false],
    [4, 8, 20, false],
    [5, 10, 25, false],
    [6, 12, 30, true],
  ])(
    "costs a 2024 character at level %i a %i penalty and %i feet",
    (level, d20TestPenalty, speedReduction, dead) => {
      expect(exhaustionEffects(level, "one")).toEqual({
        edition: "one",
        d20TestPenalty,
        speedReduction,
        dead,
      });
    },
  );

  it.each(EDITIONS)("gives a %s character at level 0 no effect to apply", (edition) => {
    const { edition: _edition, ...applied } = exhaustionEffects(0, edition);
    expect(Object.values(applied).some(Boolean)).toBe(false);
  });

  it.each([-1, 7, 2.5, Number.NaN])("rejects level %s in both rulesets", (level) => {
    for (const edition of EDITIONS) {
      expect(() => exhaustionEffects(level, edition)).toThrow(RangeError);
    }
  });
});
