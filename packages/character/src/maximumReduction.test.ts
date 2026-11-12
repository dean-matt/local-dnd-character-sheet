import { describe, expect, it } from "vitest";
import {
  defaultCharacterState,
  hitPointMaximumUnder,
  maximumBeforeReduction,
  maximumReducedState,
} from "./index.ts";

const reduction = (amount: number) => ({ amount, clearsOnLongRest: true });

const plain = { overrides: {} };
/** A definition with the hit point maximum overridden to `typed`. */
const typing = (typed: number) => ({ overrides: { hitPointMaximum: typed } });

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
    expect(hitPointMaximumUnder(plain, sheet(5), null)).toBe(30);
    expect(hitPointMaximumUnder(plain, sheet(5), reduction(8))).toBe(22);
    expect(hitPointMaximumUnder(plain, sheet(), reduction(40))).toBe(1);
  });

  it("takes the reduction from an override as typed, leaving at least 1", () => {
    expect(hitPointMaximumUnder(typing(40), sheet(5, 35), reduction(8))).toBe(32);
    expect(hitPointMaximumUnder(typing(40), sheet(5, 35), null)).toBe(40);
    expect(hitPointMaximumUnder(typing(3), sheet(5, 1), null)).toBe(3);
  });
});

describe("maximumBeforeReduction", () => {
  it("drops the reduction's term from the computed total and its terms", () => {
    expect(maximumBeforeReduction(plain, sheet(5))).toEqual({
      computed: 30,
      manual: null,
      terms: [{ label: "Hit dice", value: 30 }],
    });
  });

  it("reads the override as the definition holds it, not as the derived block last showed it", () => {
    expect(maximumBeforeReduction(typing(40), sheet(5, 35)).manual).toBe(40);
    expect(maximumBeforeReduction(typing(40), sheet(5)).manual).toBe(40);
    expect(maximumBeforeReduction(plain, sheet(5, 35)).manual).toBeNull();
    expect(hitPointMaximumUnder(plain, sheet(5, 35), null)).toBe(30);
  });

  it("reads an override the derived schema refuses as none", () => {
    for (const hitPointMaximum of [0, 2.5, "40"]) {
      expect(maximumBeforeReduction({ overrides: { hitPointMaximum } }, sheet()).manual).toBeNull();
    }
  });
});

describe("maximumReducedState", () => {
  it("lowers current hit points above the reduced maximum to it, a full character's among them", () => {
    expect(maximumReducedState(plain, sheet(), at(28), reduction(5))).toEqual({
      ...at(25),
      hitPointMaximumReduction: reduction(5),
    });
    expect(maximumReducedState(plain, sheet(), at(null), reduction(5)).hitPoints.current).toBe(25);
  });

  it("leaves current hit points at or below the reduced maximum alone", () => {
    expect(maximumReducedState(plain, sheet(), at(12), reduction(5)).hitPoints).toEqual(
      at(12).hitPoints,
    );
  });

  it("lowers current hit points to an override less the reduction", () => {
    expect(maximumReducedState(typing(40), sheet(undefined, 40), at(38), reduction(5))).toEqual({
      ...at(35),
      hitPointMaximumReduction: reduction(5),
    });
  });

  it("clears the reduction and restores no hit points", () => {
    expect(maximumReducedState(plain, sheet(5), at(25, 5), null)).toEqual(at(25));
  });
});
