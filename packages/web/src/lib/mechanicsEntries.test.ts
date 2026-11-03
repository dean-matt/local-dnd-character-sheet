import { describe, expect, it } from "vitest";
import { MECHANICS_ENTRIES } from "./mechanicsEntries.ts";

describe("MECHANICS_ENTRIES", () => {
  it("lists its entries alphabetically by label", () => {
    const labels = MECHANICS_ENTRIES.map((entry) => entry.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });
});
