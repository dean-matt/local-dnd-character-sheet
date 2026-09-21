import { describe, expect, it } from "vitest";
import { raceRecordSchema, subraceRecordSchema } from "./index.ts";

describe("raceRecordSchema", () => {
  it("accepts a catalog row", () => {
    const record = {
      name: "Elf",
      source: "PHB",
      edition: "classic",
      json: { name: "Elf", source: "PHB", entries: ["Elves are a magical people."] },
    };
    expect(raceRecordSchema.parse(record)).toEqual(record);
  });
});

describe("subraceRecordSchema", () => {
  it("accepts a subrace, keyed by its race as well as its own name and source", () => {
    const record = {
      name: "High",
      source: "PHB",
      raceName: "Elf",
      raceSource: "PHB",
      edition: "classic",
      json: { name: "High", source: "PHB" },
    };
    expect(subraceRecordSchema.parse(record)).toEqual(record);
  });

  it("accepts the empty name a base variant with no subrace of its own carries", () => {
    const record = {
      name: "",
      source: "PHB",
      raceName: "Human",
      raceSource: "PHB",
      edition: "classic",
      json: { name: "Human", source: "PHB" },
    };
    expect(subraceRecordSchema.parse(record)).toEqual(record);
  });
});
