import { describe, expect, it } from "vitest";
import { matchCatalogTarget } from "./catalogRows.ts";
import {
  HIT_COLLECTIONS,
  searchHitAddress,
  searchHitTypeLabel,
  searchHitTypePlural,
} from "./searchHits.ts";

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

  it("addresses a type with no route of its own through the catalog, its qualifier last", () => {
    expect(
      searchHitAddress({ type: "condition", name: "Restrained", source: "XPHB", edition: "one" }),
    ).toBe("/catalog/condition/Restrained/XPHB");
    const key = { type: "deity", name: "Moradin", source: "PHB", qualifier: "Dwarven" };
    const address = searchHitAddress({ ...key, edition: null });
    expect(address).toBe("/catalog/deity/Moradin/PHB/Dwarven");
    expect(matchCatalogTarget(address ?? "")?.key).toEqual(key);
  });

  it("has no address for a row with no rules text to show", () => {
    const giant = { type: "monster", name: "Fire Giant", source: "MM", edition: null };
    expect(searchHitAddress({ ...giant, textless: true })).toBeUndefined();
  });

  it("addresses a subclass under its class", () => {
    const address = searchHitAddress({
      type: "subclass",
      name: "Battle Master",
      source: "PHB",
      parent: { name: "Fighter", source: "PHB" },
      edition: "classic",
    });
    expect(address).toBe("/classes/Fighter/PHB/subclasses/Battle%20Master/PHB");
    expect(matchCatalogTarget(address ?? "")?.target.label({})).toBe("subclass");
  });
});

describe("searchHitTypeLabel", () => {
  it.each([
    ["spell", "Spell"],
    ["optfeature", "Optional feature"],
    ["variantrule", "Variant rule"],
    ["legendaryGroup", "Legendary group"],
  ])("labels %s as %s", (type, label) => {
    expect(searchHitTypeLabel(type)).toBe(label);
  });
});

describe("searchHitTypePlural", () => {
  it.each([
    ["spell", "Spells"],
    ["class", "Classes"],
    ["facility", "Facilities"],
    ["optfeature", "Optional features"],
    ["legendaryGroup", "Legendary groups"],
  ])("names %s as %s", (type, label) => {
    expect(searchHitTypePlural(type)).toBe(label);
  });
});
