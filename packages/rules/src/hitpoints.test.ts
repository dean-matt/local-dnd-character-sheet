import { describe, expect, it } from "vitest";
import {
  averageHitPoints,
  type HitDie,
  type HitPointLevel,
  hitDiceRecovered,
  maxHitPoints,
} from "./hitpoints.ts";

const levels = (die: HitDie, count: number): HitPointLevel[] =>
  Array.from({ length: count }, () => ({ die }));

describe("averageHitPoints", () => {
  it.each([
    [6, 4],
    [8, 5],
    [10, 6],
    [12, 7],
  ] as const)("a d%i gives the class table's %i", (die, expected) => {
    expect(averageHitPoints(die)).toBe(expected);
  });
});

describe("maxHitPoints", () => {
  it("gives level 1 the highest face of the die", () => {
    expect(maxHitPoints(levels(10, 1), 0)).toBe(10);
  });

  it("gives levels after the first the average", () => {
    expect(maxHitPoints(levels(10, 3), 0)).toBe(10 + 6 + 6);
  });

  it("takes a roll over the average, except at level 1", () => {
    const rolled: HitPointLevel[] = [
      { die: 10, rolled: 2 },
      { die: 10, rolled: 9 },
    ];
    expect(maxHitPoints(rolled, 0)).toBe(10 + 9);
  });

  it("adds the constitution modifier once per level", () => {
    expect(maxHitPoints(levels(8, 4), 2)).toBe(8 + 5 + 5 + 5 + 4 * 2);
  });

  it("moves every level's contribution when the constitution modifier changes", () => {
    const eight = levels(8, 5);
    expect(maxHitPoints(eight, 3) - maxHitPoints(eight, 2)).toBe(5);
    expect(maxHitPoints(eight, 1) - maxHitPoints(eight, 0)).toBe(5);
  });

  it("sums a multiclass list in the order the levels were taken", () => {
    const fighterThenWizard: HitPointLevel[] = [{ die: 10 }, { die: 10 }, { die: 6 }];
    const wizardThenFighter: HitPointLevel[] = [{ die: 6 }, { die: 6 }, { die: 10 }];
    expect(maxHitPoints(fighterThenWizard, 1)).toBe(10 + 6 + 4 + 3);
    expect(maxHitPoints(wizardThenFighter, 1)).toBe(6 + 4 + 6 + 3);
  });

  it("floors a level at 1 hit point however punishing the modifier", () => {
    expect(maxHitPoints(levels(6, 3), -5)).toBe(1 + 1 + 1);
  });

  it("rejects a level list with no levels", () => {
    expect(() => maxHitPoints([], 0)).toThrow(RangeError);
  });

  it.each([4, 20, 0])("rejects a d%i, which no class has", (die) => {
    expect(() => maxHitPoints([{ die: die as HitDie }], 0)).toThrow(RangeError);
  });

  it.each([0, 9, 1.5])("rejects %s as a roll of a d8", (rolled) => {
    expect(() => maxHitPoints([{ die: 8 }, { die: 8, rolled }], 0)).toThrow(RangeError);
  });

  it("rejects a corrupt roll on the first level, which otherwise discards it", () => {
    expect(() => maxHitPoints([{ die: 8, rolled: 40 }], 0)).toThrow(RangeError);
  });
});

describe("hitDiceRecovered", () => {
  it.each([
    [1, 1],
    [2, 1],
    [3, 1],
    [8, 4],
    [9, 4],
    [20, 10],
  ])("a classic long rest returns %i of %i dice", (total, expected) => {
    expect(hitDiceRecovered([total], "classic")).toBe(expected);
  });

  it.each([1, 8, 20])("a 2024 long rest returns all %i dice", (total) => {
    expect(hitDiceRecovered([total], "one")).toBe(total);
  });

  it("halves the pools together, not one by one", () => {
    expect(hitDiceRecovered([1, 1], "classic")).toBe(1);
    expect(hitDiceRecovered([2, 2], "classic")).toBe(2);
    expect(hitDiceRecovered([5, 5], "classic")).toBe(5);
  });

  it.each(["classic", "one"] as const)("returns nothing from an empty pool under %s", (edition) => {
    expect(hitDiceRecovered([], edition)).toBe(0);
    expect(hitDiceRecovered([0, 0], edition)).toBe(0);
  });

  it.each([-1, 1.5])("rejects a pool of %s", (total) => {
    expect(() => hitDiceRecovered([1, total], "classic")).toThrow(RangeError);
  });
});
