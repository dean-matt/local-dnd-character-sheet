import { describe, expect, it } from "vitest";
import {
  backgroundRecordSchema,
  featRecordSchema,
  homebrewBackgroundInputSchema,
  homebrewBackgroundRecordSchema,
  homebrewFeatInputSchema,
  homebrewFeatRecordSchema,
} from "./index.ts";

describe("backgroundRecordSchema", () => {
  it("accepts a catalog row", () => {
    const record = {
      name: "Acolyte",
      source: "PHB",
      edition: "classic",
      json: { name: "Acolyte", source: "PHB", entries: ["You have spent your life in service."] },
    };
    expect(backgroundRecordSchema.parse(record)).toEqual(record);
  });
});

describe("homebrewBackgroundInputSchema", () => {
  it("accepts a name and an edition without a source", () => {
    const parsed = homebrewBackgroundInputSchema.parse({ name: "Wanderer", edition: "one" });
    expect(parsed).toEqual({ name: "Wanderer", edition: "one" });
  });

  it("keeps a field this schema does not model, such as skill proficiencies", () => {
    const withUnmodeledFields = { name: "Wanderer", edition: "one", skillProficiencies: [{}] };
    expect(homebrewBackgroundInputSchema.parse(withUnmodeledFields)).toEqual(withUnmodeledFields);
  });

  it("rejects a missing name, naming the failed field", () => {
    const result = homebrewBackgroundInputSchema.safeParse({ edition: "one" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["name"]);
  });

  it("rejects an edition outside the two rulesets", () => {
    const result = homebrewBackgroundInputSchema.safeParse({ name: "Wanderer", edition: "3.5" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["edition"]);
  });
});

describe("homebrewBackgroundRecordSchema", () => {
  it("accepts a stored row", () => {
    const record = {
      id: "1",
      name: "Wanderer",
      edition: "one",
      json: { name: "Wanderer", source: "HB" },
      createdAt: new Date(0).toISOString(),
    };
    expect(homebrewBackgroundRecordSchema.parse(record)).toEqual(record);
  });
});

describe("featRecordSchema", () => {
  it("accepts a catalog row", () => {
    const record = {
      name: "Alert",
      source: "PHB",
      edition: "classic",
      json: { name: "Alert", source: "PHB", entries: ["Always on the lookout for danger."] },
    };
    expect(featRecordSchema.parse(record)).toEqual(record);
  });
});

describe("homebrewFeatInputSchema", () => {
  it("accepts a name and an edition without a source", () => {
    const parsed = homebrewFeatInputSchema.parse({ name: "Ironbound", edition: "one" });
    expect(parsed).toEqual({ name: "Ironbound", edition: "one" });
  });

  it("keeps a field this schema does not model, such as a prerequisite", () => {
    const withUnmodeledFields = {
      name: "Ironbound",
      edition: "one",
      prerequisite: [{ ability: [{ str: 13 }] }],
    };
    expect(homebrewFeatInputSchema.parse(withUnmodeledFields)).toEqual(withUnmodeledFields);
  });

  it("rejects a missing name, naming the failed field", () => {
    const result = homebrewFeatInputSchema.safeParse({ edition: "one" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["name"]);
  });

  it("rejects an edition outside the two rulesets", () => {
    const result = homebrewFeatInputSchema.safeParse({ name: "Ironbound", edition: "3.5" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["edition"]);
  });
});

describe("homebrewFeatRecordSchema", () => {
  it("accepts a stored row", () => {
    const record = {
      id: "1",
      name: "Ironbound",
      edition: "one",
      json: { name: "Ironbound", source: "HB" },
      createdAt: new Date(0).toISOString(),
    };
    expect(homebrewFeatRecordSchema.parse(record)).toEqual(record);
  });
});
