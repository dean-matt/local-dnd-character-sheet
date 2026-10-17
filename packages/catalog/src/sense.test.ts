import { describe, expect, it } from "vitest";
import { featGrantsSchema, senseGrantsSchema } from "./index.ts";

describe("senseGrantsSchema", () => {
  it("reads a race's darkvision and its one blindsight", () => {
    expect(senseGrantsSchema.parse({ name: "Elf", darkvision: 60 })).toEqual([
      { name: "darkvision", range: 60 },
    ]);
    expect(senseGrantsSchema.parse({ darkvision: 60, blindsight: 30 })).toEqual([
      { name: "blindsight", range: 30 },
      { name: "darkvision", range: 60 },
    ]);
  });

  it("reads a feat's or an item's senses list, keeping the longest range of a sense", () => {
    expect(
      senseGrantsSchema.parse({
        senses: [{ blindsight: 10 }, { truesight: 60 }, { blindsight: 15 }],
      }),
    ).toEqual([
      { name: "blindsight", range: 15 },
      { name: "truesight", range: 60 },
    ]);
  });

  it("grants nothing from a malformed field rather than refusing the row", () => {
    expect(senseGrantsSchema.parse({ darkvision: "far", senses: "dark" })).toEqual([]);
    expect(senseGrantsSchema.parse({ darkvision: 0, senses: [{ sight: 5 }] })).toEqual([]);
  });

  it("reaches a feat row's grants", () => {
    expect(
      featGrantsSchema.parse({ name: "Blind Fighting", senses: [{ blindsight: 10 }] }).senses,
    ).toEqual([{ name: "blindsight", range: 10 }]);
  });
});
