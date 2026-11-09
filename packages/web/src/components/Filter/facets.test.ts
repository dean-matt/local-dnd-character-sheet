import { describe, expect, it } from "vitest";
import { inRange, NO_RANGE } from "./facets.ts";

describe("inRange", () => {
  it("matches everything, even no value, when no bound is set", () => {
    expect(inRange(undefined, NO_RANGE)).toBe(true);
    expect(inRange(3, NO_RANGE)).toBe(true);
  });

  it("holds a value to the one bound set, and never matches no value", () => {
    expect(inRange(2, { min: "2", max: "" })).toBe(true);
    expect(inRange(1, { min: "2", max: "" })).toBe(false);
    expect(inRange(2, { min: "", max: "2" })).toBe(true);
    expect(inRange(3, { min: "", max: "2" })).toBe(false);
    expect(inRange(undefined, { min: "", max: "9" })).toBe(false);
  });

  it("matches nothing when the minimum is above the maximum", () => {
    expect(inRange(2, { min: "3", max: "1" })).toBe(false);
  });
});
