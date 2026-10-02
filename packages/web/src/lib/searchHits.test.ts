import { describe, expect, it } from "vitest";
import { searchHitPath, searchHitTypeLabel } from "./searchHits.ts";

describe("searchHitPath", () => {
  it("addresses a catalog hit by its encoded name and source", () => {
    const hit = { type: "item", name: "+1 Longsword", source: "DMG", edition: "classic" as const };
    expect(searchHitPath(hit)).toBe("/catalog/items/%2B1%20Longsword/DMG");
  });

  it("addresses a homebrew hit by its id", () => {
    expect(searchHitPath({ type: "spell", id: "7", name: "Ember", edition: "one" })).toBe(
      "/catalog/homebrew/spells/7",
    );
  });

  it("has no path for a type without a detail route", () => {
    expect(
      searchHitPath({ type: "monster", name: "Fire Giant", source: "MM", edition: null }),
    ).toBeUndefined();
  });
});

describe("searchHitTypeLabel", () => {
  it.each([
    ["spell", "Spell"],
    ["optfeature", "Optional feature"],
    ["legendaryGroup", "Legendary group"],
  ])("labels %s as %s", (type, label) => {
    expect(searchHitTypeLabel(type)).toBe(label);
  });
});
