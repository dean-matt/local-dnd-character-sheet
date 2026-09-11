import { describe, expect, it } from "vitest";
import {
  carryingCapacity,
  encumbranceThresholds,
  pushDragLiftCapacity,
  SIZES,
  type Size,
} from "./carrying.ts";

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
      encumbered,
      heavilyEncumbered: heavy,
    });
  });

  it("stops a Tiny creature at the weight it can carry", () => {
    expect(encumbranceThresholds(14, "tiny")).toEqual({
      encumbered: 70,
      heavilyEncumbered: carryingCapacity(14, "tiny"),
    });
  });

  it.each(SIZES)("never passes what a %s creature can carry", (size) => {
    for (const score of [1, 8, 14, 20, 30]) {
      const { encumbered, heavilyEncumbered } = encumbranceThresholds(score, size);
      expect(heavilyEncumbered).toBeLessThanOrEqual(carryingCapacity(score, size));
      expect(encumbered).toBeLessThanOrEqual(heavilyEncumbered);
    }
  });
});
