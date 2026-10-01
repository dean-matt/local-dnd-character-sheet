import { describe, expect, it } from "vitest";
import { z } from "zod";
import { derivedSchema, derivedValue } from "./index.ts";

describe("derived fields", () => {
  const schema = derivedSchema(z.int());

  it("defaults to no override, matching an absent field_overrides row", () => {
    expect(schema.parse({ computed: 38 })).toEqual({ computed: 38, manual: null, terms: [] });
    expect(derivedValue({ computed: 38, manual: null })).toBe(38);
  });

  it("carries the terms behind the computed value, beside it rather than reconstructed later", () => {
    const terms = [{ label: "Base", value: 38, reference: { name: "Fighter", source: "PHB" } }];
    expect(schema.parse({ computed: 38, terms })).toEqual({ computed: 38, manual: null, terms });
  });

  it.each([
    ["a catalog row", { name: "Fighter", source: "PHB" }],
    ["another derived field", { derivedField: "hitPointMaximum" }],
    ["a house-rule option", { houseRuleOption: "encumbrance" }],
  ])("accepts a term referencing %s", (_label, reference) => {
    const terms = [{ label: "Base", value: 38, reference }];
    expect(schema.parse({ computed: 38, terms }).terms).toEqual(terms);
  });
});

describe("a key the schema does not name", () => {
  it("fails a derived field, whose two states have no room for a third", () => {
    expect(derivedSchema(z.int()).safeParse({ computed: 38, cleared: true }).success).toBe(false);
  });
});
