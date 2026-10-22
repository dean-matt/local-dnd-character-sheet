import { describe, expect, it } from "vitest";
import { optionsGained } from "./optionsGained.ts";

const table = (...counts: [string, number][]) => ({
  optionalFeatures: counts.map(([featureType, known]) => ({ featureType, known })),
});

describe("optionsGained", () => {
  it("adds the difference between the running totals, not the total", () => {
    expect(optionsGained(table(["EI", 3]), table(["EI", 5]))).toEqual([
      { featureType: "EI", count: 2 },
    ]);
  });

  it("adds every option of a type the table first counts at this level", () => {
    expect(optionsGained(undefined, table(["MV:B", 3]))).toEqual([
      { featureType: "MV:B", count: 3 },
    ]);
  });

  it("adds nothing where a total holds", () => {
    expect(optionsGained(table(["MM", 2]), table(["MM", 2]))).toEqual([]);
  });
});
