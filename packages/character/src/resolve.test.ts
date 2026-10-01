import { describe, expect, it } from "vitest";
import { z } from "zod";
import { characterDefinitionSchema, derivedSchema, derivedValue, houseRule } from "./index.ts";
import { definition } from "./test/vex.ts";

describe("houseRules", () => {
  it("falls back to the printed rule for an option the table never named", () => {
    const parsed = characterDefinitionSchema.parse({ ...definition, houseRules: {} });
    expect(houseRule(parsed, "encumbrance")).toBe(false);
    expect(houseRule(parsed, "optionalClassFeatures")).toBe(false);
  });

  it("falls back to the printed rule for an option stored as undefined", () => {
    const parsed = characterDefinitionSchema.parse({
      ...definition,
      houseRules: { encumbrance: undefined },
    });
    expect(houseRule(parsed, "encumbrance")).toBe(false);
  });

  it("reads back the option the table set", () => {
    const parsed = characterDefinitionSchema.parse(structuredClone(definition));
    expect(houseRule(parsed, "encumbrance")).toBe(true);
  });
});

describe("derived fields", () => {
  const schema = derivedSchema(z.int());

  it("prefers the manual value without disturbing the computed one", () => {
    const field = schema.parse({ computed: 38, manual: 45 });
    expect(derivedValue(field)).toBe(45);
    expect(derivedValue({ ...field, computed: 52 })).toBe(45);
  });

  it("restores the computed value when the override is cleared", () => {
    expect(derivedValue({ computed: 38, manual: null })).toBe(38);
  });
});
