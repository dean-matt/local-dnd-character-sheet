import { describe, expect, it } from "vitest";
import { searchHitSchema } from "./index.ts";

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
