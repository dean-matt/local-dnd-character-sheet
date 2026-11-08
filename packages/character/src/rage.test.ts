import { describe, expect, it } from "vitest";
import { defaultCharacterState, isRaging, rageBlockedBy, rageEnded, rageStarted } from "./index.ts";

const BARBARIAN = { name: "Barbarian", source: "PHB" };
const pool = (maximum: number | null, expended: number) => ({
  class: BARBARIAN,
  key: "rages",
  maximum,
  expended,
});
const unarmored = { heavyArmorWorn: false };

describe("starting a rage", () => {
  it("spends a use and marks the character as raging", () => {
    const started = rageStarted(defaultCharacterState(), pool(3, 1));
    expect(started.classResources).toEqual([pool(3, 2)]);
    expect(isRaging(started)).toBe(true);
  });

  it("spends nothing from an unlimited pool, and has nothing to run down", () => {
    const started = rageStarted(defaultCharacterState(), pool(null, 0));
    expect(started.classResources).toEqual([]);
    expect(isRaging(started)).toBe(true);
    expect(rageBlockedBy(unarmored, pool(null, 40))).toBeNull();
  });

  it("is blocked with no use left, or in heavy armor, and says why", () => {
    expect(rageBlockedBy(unarmored, pool(3, 3))).toBe("No Rage use left.");
    expect(rageBlockedBy({ heavyArmorWorn: true }, pool(3, 0))).toBe("Heavy armor is worn.");
    expect(rageBlockedBy(unarmored, pool(3, 2))).toBeNull();
  });
});

describe("ending a rage", () => {
  it("clears the rage and restores no use", () => {
    const started = rageStarted(defaultCharacterState(), pool(3, 0));
    const ended = rageEnded(started);
    expect(isRaging(ended)).toBe(false);
    expect(ended.classResources).toEqual([pool(3, 1)]);
  });
});
