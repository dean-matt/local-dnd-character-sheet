import { describe, expect, it } from "vitest";
import {
  type HomebrewItem,
  homebrewItemInputSchema,
  homebrewItemRecordSchema,
  homebrewItemSchema,
  itemRecordSchema,
} from "./index.ts";

const minimal = { name: "Sunblade", source: "Homebrew" };

describe("homebrewItemSchema", () => {
  it("accepts the minimal shape", () => {
    const parsed: HomebrewItem = homebrewItemSchema.parse(minimal);
    expect(parsed).toEqual(minimal);
  });

  it("keeps a field this schema does not model, such as weight or value", () => {
    const withUnmodeledFields = { ...minimal, weight: 3, value: 500, dmg1: "1d8" };
    expect(homebrewItemSchema.parse(withUnmodeledFields)).toEqual(withUnmodeledFields);
  });

  it("accepts reqAttune as a boolean", () => {
    expect(homebrewItemSchema.parse({ ...minimal, reqAttune: true }).reqAttune).toBe(true);
  });

  it("accepts reqAttune as a condition string", () => {
    const withCondition = { ...minimal, reqAttune: "by a spellcaster" };
    expect(homebrewItemSchema.parse(withCondition).reqAttune).toBe("by a spellcaster");
  });

  it("rejects a missing name, naming the failed field", () => {
    const result = homebrewItemSchema.safeParse({ source: "Homebrew" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["name"]);
  });

  it("rejects an empty name rather than accepting a blank catalog key", () => {
    const result = homebrewItemSchema.safeParse({ name: "", source: "Homebrew" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["name"]);
  });

  it("rejects reqAttune written as neither a flag nor a condition", () => {
    const result = homebrewItemSchema.safeParse({ ...minimal, reqAttune: 1 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["reqAttune"]);
  });
});

describe("homebrewItemInputSchema", () => {
  it("accepts a name and an edition without a source", () => {
    const parsed = homebrewItemInputSchema.parse({ name: "Sunblade", edition: "one" });
    expect(parsed).toEqual({ name: "Sunblade", edition: "one" });
  });

  it("rejects an edition outside the two rulesets", () => {
    const result = homebrewItemInputSchema.safeParse({ name: "Sunblade", edition: "3.5" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["edition"]);
  });
});

describe("homebrewItemRecordSchema", () => {
  it("accepts a stored row", () => {
    const record = {
      id: "1",
      name: "Sunblade",
      edition: "one",
      type: null,
      rarity: null,
      requiresAttunement: false,
      json: { name: "Sunblade", source: "HB" },
      createdAt: new Date(0).toISOString(),
    };
    expect(homebrewItemRecordSchema.parse(record)).toEqual(record);
  });
});

describe("itemRecordSchema", () => {
  it("accepts a catalog row, keyed by name and source rather than id", () => {
    const record = {
      name: "Longsword",
      source: "PHB",
      edition: "classic",
      kind: "baseitem",
      type: "M",
      rarity: null,
      requiresAttunement: false,
      json: { name: "Longsword", source: "PHB" },
    };
    expect(itemRecordSchema.parse(record)).toEqual(record);
  });
});
