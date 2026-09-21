import { describe, expect, it } from "vitest";
import { backgroundRecordSchema, featRecordSchema } from "./index.ts";

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
