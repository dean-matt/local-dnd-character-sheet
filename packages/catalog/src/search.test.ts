import { describe, expect, it } from "vitest";
import { compareSearchHits, searchHitSchema } from "./index.ts";

describe("searchHitSchema", () => {
  it("accepts a catalog hit, Tier A or Tier C", () => {
    const hit = { type: "spell", name: "Fireball", source: "PHB", edition: "classic" };
    expect(searchHitSchema.parse(hit)).toEqual(hit);
  });

  it("accepts a Tier C hit with no edition", () => {
    const hit = { type: "trap", name: "Falling Net", source: "DMG", edition: null };
    expect(searchHitSchema.parse(hit)).toEqual(hit);
  });

  it("accepts a homebrew hit, addressed by id rather than source", () => {
    const hit = { type: "item", id: "1", name: "Sunblade", edition: "one" };
    expect(searchHitSchema.parse(hit)).toEqual(hit);
  });

  it("rejects a hit carrying both source and id", () => {
    const hit = { type: "item", id: "1", name: "Sunblade", source: "PHB", edition: "one" };
    expect(() => searchHitSchema.parse(hit)).toThrow();
  });
});

describe("compareSearchHits", () => {
  const hit = (name: string) => ({
    type: "spell",
    name,
    source: "PHB",
    edition: "classic" as const,
  });
  const ranked = (term: string, names: string[]) =>
    names
      .map(hit)
      .sort(compareSearchHits(term))
      .map((h) => h.name);

  it("ranks the whole name, then a name starting with the term, then one holding it, then a text-only hit", () => {
    expect(ranked("fire", ["Abominable Yeti", "Wall of Fire", "Fireball", "Fire"])).toEqual([
      "Fire",
      "Fireball",
      "Wall of Fire",
      "Abominable Yeti",
    ]);
  });

  it("puts the shorter name first within a rank, then sorts alphabetically", () => {
    expect(ranked("fire", ["Fire Giant", "Fire Bolt", "Fireball", "Fire Elemental"])).toEqual([
      "Fireball",
      "Fire Bolt",
      "Fire Giant",
      "Fire Elemental",
    ]);
  });

  it("matches the term regardless of case or surrounding space", () => {
    expect(ranked("  FIRE ", ["Abominable Yeti", "Faerie Fire"])).toEqual([
      "Faerie Fire",
      "Abominable Yeti",
    ]);
  });
});
