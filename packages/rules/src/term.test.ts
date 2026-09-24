import { describe, expect, it } from "vitest";
import { breakdown } from "./index.ts";

describe("breakdown", () => {
  it("totals to zero for no terms", () => {
    expect(breakdown([])).toEqual({ total: 0, terms: [] });
  });

  it("sums the terms it is given, whatever supplied them", () => {
    const terms = [
      { label: "Armor", value: 11 },
      { label: "Dexterity", value: 2, reference: { name: "Leather Armor", source: "PHB" } },
      { label: "Shield", value: 2 },
    ];
    expect(breakdown(terms)).toEqual({ total: 15, terms });
  });

  it("echoes back whatever reference a caller attached, unexamined", () => {
    const reference = { houseRuleOption: "encumbrance" };
    const result = breakdown([{ label: "Encumbrance", value: 10, reference }]);
    expect(result.terms[0]?.reference).toBe(reference);
  });
});
