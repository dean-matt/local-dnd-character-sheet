import { describe, expect, it } from "vitest";
import { matchCatalogTarget } from "./catalogRows.ts";
import { HIT_COLLECTIONS, searchHitAddress, searchHitTypeLabel } from "./searchHits.ts";

describe("searchHitAddress", () => {
  it("addresses a catalog hit by its encoded name and source", () => {
    const hit = { type: "item", name: "+1 Longsword", source: "DMG", edition: "classic" as const };
    expect(searchHitAddress(hit)).toBe("/items/%2B1%20Longsword/DMG");
  });

  it("addresses a homebrew hit by its id", () => {
    expect(searchHitAddress({ type: "spell", id: "7", name: "Ember", edition: "one" })).toBe(
      "/homebrew/spells/7",
    );
  });

  it.each([...HIT_COLLECTIONS.keys()])(
    "addresses a %s hit at an address a catalog target reads",
    (type) => {
      const address = searchHitAddress({
        type,
        name: "Mage Hand / Legerdemain",
        source: "XPHB",
        edition: "one",
      });
      expect(matchCatalogTarget(address ?? "")?.key).toEqual({
        name: "Mage Hand / Legerdemain",
        source: "XPHB",
      });
    },
  );

  it.each(["item", "spell"] as const)(
    "addresses a homebrew %s hit at an address a catalog target reads",
    (type) => {
      const address = searchHitAddress({ type, id: "a1", name: "Ember", edition: "one" });
      expect(matchCatalogTarget(address ?? "")?.key).toEqual({ id: "a1" });
    },
  );

  it.each(["monster", "constructor"])("has no path for the type %s", (type) => {
    expect(
      searchHitAddress({ type, name: "Fire Giant", source: "MM", edition: null }),
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
