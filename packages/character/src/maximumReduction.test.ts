import { describe, expect, it } from "vitest";
import { defaultCharacterState, hitPointMaximumUnder, maximumReducedState } from "./index.ts";

const reduction = (amount: number) => ({ amount, clearsOnLongRest: true });

/** A 30 maximum, reduced by `held` where given, as the derived block shows it. */
const sheet = (held?: number, manual: number | null = null) => ({
  hitPointMaximum: {
    computed: 30 - (held ?? 0),
    manual,
    terms: [
      { label: "Hit dice", value: 30 },
      ...(held ? [{ label: "Maximum reduction", value: -held }] : []),
    ],
  },
});

const at = (current: number | null, held?: number) => ({
  ...defaultCharacterState(),
  hitPoints: { current, temporary: 3 },
  hitPointMaximumReduction: held ? reduction(held) : null,
});

describe("hitPointMaximumUnder", () => {
  it("reads the maximum with another reduction in place of the one held", () => {
    expect(hitPointMaximumUnder(sheet(5), null)).toBe(30);
    expect(hitPointMaximumUnder(sheet(5), reduction(8))).toBe(22);
    expect(hitPointMaximumUnder(sheet(), reduction(40))).toBe(1);
  });

  it("reads an override as typed, since it replaces every term", () => {
    expect(hitPointMaximumUnder(sheet(5, 40), reduction(8))).toBe(40);
  });
});

describe("maximumReducedState", () => {
  it("lowers current hit points above the reduced maximum to it, a full character's among them", () => {
    expect(maximumReducedState(sheet(), at(28), reduction(5))).toEqual({
      ...at(25),
      hitPointMaximumReduction: reduction(5),
    });
    expect(maximumReducedState(sheet(), at(null), reduction(5)).hitPoints.current).toBe(25);
  });

  it("leaves current hit points at or below the reduced maximum alone", () => {
    expect(maximumReducedState(sheet(), at(12), reduction(5)).hitPoints).toEqual(at(12).hitPoints);
  });

  it("clears the reduction and restores no hit points", () => {
    expect(maximumReducedState(sheet(5), at(25, 5), null)).toEqual(at(25));
  });
});
