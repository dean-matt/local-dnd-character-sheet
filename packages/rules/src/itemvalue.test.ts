import { describe, expect, it } from "vitest";
import { magicItemValue, spellScrollValue } from "./index.ts";

const GP = 100;

describe("magicItemValue", () => {
  it.each([
    ["common", 100],
    ["uncommon", 400],
    ["rare", 4000],
    ["very rare", 40000],
    ["legendary", 200000],
  ])("prices a 2024 %s item at %i gp, and a consumable at half", (rarity, gold) => {
    const table = "Magic Item Rarities and Values";
    expect(magicItemValue(rarity, "one", false)).toEqual({
      kind: "amount",
      table,
      copper: gold * GP,
    });
    expect(magicItemValue(rarity, "one", true)).toEqual({
      kind: "amount",
      table,
      copper: (gold * GP) / 2,
    });
  });

  it.each([
    ["common", 50, 100],
    ["uncommon", 101, 500],
    ["rare", 501, 5000],
    ["very rare", 5001, 50000],
    ["legendary", 50001, null],
  ])("prices a 2014 %s item from %i to %s gp, and a consumable at half", (rarity, min, max) => {
    const table = "Magic Item Rarity";
    expect(magicItemValue(rarity, "classic", false)).toEqual({
      kind: "range",
      table,
      min: min * GP,
      max: max === null ? null : max * GP,
    });
    expect(magicItemValue(rarity, "classic", true)).toEqual({
      kind: "range",
      table,
      min: (min * GP) / 2,
      max: max === null ? null : (max * GP) / 2,
    });
  });

  it.each(["classic", "one"] as const)(
    "calls an artifact priceless in the %s edition",
    (edition) => {
      expect(magicItemValue("artifact", edition, false)?.kind).toBe("priceless");
    },
  );

  it.each(["none", "unknown", "unknown (magic)", "varies"])("prices %s as nothing", (rarity) => {
    expect(magicItemValue(rarity, "one", false)).toBeNull();
    expect(magicItemValue(rarity, "classic", false)).toBeNull();
  });
});

describe("spellScrollValue", () => {
  it.each([
    [0, 15],
    [1, 25],
    [2, 100],
    [3, 150],
    [4, 1000],
    [5, 1500],
    [6, 10000],
    [7, 12500],
    [8, 15000],
    [9, 50000],
  ])("doubles the %i-level scribing cost of %i gp", (level, gold) => {
    expect(spellScrollValue(level)).toEqual({
      kind: "amount",
      table: "Spell Scroll Costs",
      copper: gold * 2 * GP,
    });
  });

  it("prices no level outside 0 to 9", () => {
    expect(spellScrollValue(10)).toBeNull();
    expect(spellScrollValue(-1)).toBeNull();
  });
});
