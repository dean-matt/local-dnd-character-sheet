import { describe, expect, it } from "vitest";
import { narrowingParams, readSearchFilters, writeSearchFilters } from "./searchFilters.ts";

const read = (query: string) => readSearchFilters(new URLSearchParams(query));

describe("searchFilters", () => {
  it("round-trips every filter through the URL", () => {
    const query =
      "q=fire&type=spell%2Citem&edition=one&source=PHB%2CXGE&minLevel=1&maxLevel=3&school=V%2CA&rarity=rare&offset=50";
    expect(writeSearchFilters(read(query)).toString()).toBe(query);
  });

  it("leaves a filter at its default out of the URL", () => {
    expect(writeSearchFilters(read("q=fire&minLevel=0&maxLevel=9&offset=0")).toString()).toBe(
      "q=fire",
    );
  });

  it("drops the spell and item filters unless the types include spells or items", () => {
    expect(narrowingParams(read("type=item&minLevel=2&school=V&source=DMG"))).toEqual({
      source: "DMG",
    });
    expect(narrowingParams(read("type=spell&rarity=rare"))).toEqual({});
  });

  it("reads an unknown edition as both and clamps a level into 0 to 9", () => {
    expect(read("edition=third&type=spell&minLevel=-3&maxLevel=12")).toMatchObject({
      edition: undefined,
      minLevel: 0,
      maxLevel: 9,
    });
  });

  it("reads a backwards level range the right way round", () => {
    expect(read("type=spell&minLevel=5&maxLevel=2")).toMatchObject({ minLevel: 2, maxLevel: 5 });
  });
});
