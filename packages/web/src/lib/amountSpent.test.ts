import { describe, expect, it } from "vitest";
import { amountSpent, type FeatureResource } from "./featureResource.ts";

const resource = { min: 1, max: 5 } as FeatureResource;

describe("amountSpent", () => {
  it("takes the least for a cleared amount", () => {
    expect(amountSpent(resource, Number.NaN)).toBe(1);
    expect(amountSpent(resource, null)).toBe(1);
  });

  it("rounds a fractional amount and holds it in range", () => {
    expect(amountSpent(resource, 2.5)).toBe(3);
    expect(amountSpent(resource, 2.4)).toBe(2);
    expect(amountSpent(resource, 9)).toBe(5);
  });
});
