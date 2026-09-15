import { describe, expect, it } from "vitest";
import {
  carryingCapacity,
  encumbranceAt,
  encumbranceThresholds,
  pushDragLiftCapacity,
  SIZES,
  type Size,
} from "./index.ts";

describe("carryingCapacity", () => {
  it.each([
    ["tiny", 7.5],
    ["small", 15],
    ["medium", 15],
    ["large", 30],
    ["huge", 60],
    ["gargantuan", 120],
  ] as const)("a %s creature carries strength x %i", (size, perPoint) => {
    expect(carryingCapacity(1, size)).toBe(perPoint);
    expect(carryingCapacity(16, size)).toBe(16 * perPoint);
  });

  it("rejects a size outside the vocabulary", () => {
    expect(() => carryingCapacity(10, "titanic" as Size)).toThrow(RangeError);
  });

  it.each(["constructor", "toString"])("rejects the inherited key %s", (size) => {
    expect(() => carryingCapacity(10, size as Size)).toThrow(RangeError);
  });
});

describe("pushDragLiftCapacity", () => {
  it.each(["tiny", "medium", "gargantuan"] as const)(
    "is twice what a %s creature carries",
    (size) => {
      expect(pushDragLiftCapacity(15, size)).toBe(carryingCapacity(15, size) * 2);
    },
  );

  it("gives a Strength 15 Medium creature 450 pounds", () => {
    expect(pushDragLiftCapacity(15, "medium")).toBe(450);
  });
});

describe("encumbranceThresholds", () => {
  it.each([
    [14, 70, 140],
    [1, 5, 10],
  ])("a Strength of %i is encumbered at %i and heavily at %i", (score, encumbered, heavy) => {
    expect(encumbranceThresholds(score, "medium")).toEqual({
      encumbered: { atWeight: encumbered, speedReduction: 10, disadvantage: false },
      heavilyEncumbered: { atWeight: heavy, speedReduction: 20, disadvantage: true },
    });
  });

  it("stops a Tiny creature at the weight it can carry", () => {
    expect(encumbranceThresholds(14, "tiny")).toEqual({
      encumbered: { atWeight: 70, speedReduction: 10, disadvantage: false },
      heavilyEncumbered: {
        atWeight: carryingCapacity(14, "tiny"),
        speedReduction: 20,
        disadvantage: true,
      },
    });
  });

  it.each(SIZES)("never passes what a %s creature can carry", (size) => {
    for (const score of [1, 8, 14, 20, 30]) {
      const { encumbered, heavilyEncumbered } = encumbranceThresholds(score, size);
      expect(heavilyEncumbered.atWeight).toBeLessThanOrEqual(carryingCapacity(score, size));
      expect(encumbered.atWeight).toBeLessThanOrEqual(heavilyEncumbered.atWeight);
    }
  });
});

describe("encumbranceAt", () => {
  it.each([
    [0, 0, false],
    [70, 0, false],
    [70.5, 10, false],
    [140, 10, false],
    [140.5, 20, true],
    [1000, 20, true],
  ])("carrying %d costs a Strength 14 Medium creature %i feet", (weight, speed, disadvantage) => {
    expect(encumbranceAt(14, "medium", weight)).toEqual({
      speedReduction: speed,
      disadvantage,
    });
  });

  it("never returns the shared penalty object a caller could mutate", () => {
    const penalty = encumbranceAt(14, "medium", 1000);
    penalty.speedReduction = 0;
    expect(encumbranceAt(14, "medium", 1000).speedReduction).toBe(20);
  });

  it.each(SIZES)("costs a %s creature nothing at a threshold it has only reached", (size) => {
    const { encumbered, heavilyEncumbered } = encumbranceThresholds(14, size);
    expect(encumbranceAt(14, size, encumbered.atWeight).speedReduction).toBe(0);
    expect(encumbranceAt(14, size, heavilyEncumbered.atWeight).speedReduction).toBe(10);
    expect(encumbranceAt(14, size, heavilyEncumbered.atWeight + 1)).toEqual({
      speedReduction: 20,
      disadvantage: true,
    });
  });
});
