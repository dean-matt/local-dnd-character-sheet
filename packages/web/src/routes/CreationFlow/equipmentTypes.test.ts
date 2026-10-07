import type { ItemHitFacts, SearchHit } from "@dnd/catalog";
import { describe, expect, it } from "vitest";
import { typeMismatch } from "./equipmentTypes.ts";

const hit = (name: string, item: Partial<ItemHitFacts>): SearchHit => ({
  type: "item",
  name,
  source: "PHB",
  edition: "classic",
  item: { kinds: ["tool"], rarity: "none", category: null, ...item },
});

const dice = hit("Dice Set", { tool: "gaming" });
const lute = hit("Lute", { tool: "instrument" });
const smith = hit("Smith's Tools", { tool: "artisan" });
const thieves = hit("Thieves' Tools", { tool: "other" });

describe("typeMismatch", () => {
  it("offers a tool slot only the tools of its kind", () => {
    expect(typeMismatch(["setGaming"], dice)).toBeUndefined();
    expect(typeMismatch(["setGaming"], smith)).toBe("not a gaming set");
    expect(typeMismatch(["setGaming"], thieves)).toBe("not a gaming set");
  });

  it("offers a slot of two kinds the tools of either", () => {
    const types = ["instrumentMusical", "toolArtisan"];
    expect(typeMismatch(types, lute)).toBeUndefined();
    expect(typeMismatch(types, smith)).toBeUndefined();
    expect(typeMismatch(types, dice)).toBe("not a musical instrument or artisan's tools");
  });

  it("offers a weapon slot only the weapons of its category", () => {
    const sword = hit("Longsword", { kinds: ["melee"], category: "martial" });
    expect(typeMismatch(["weaponMartial"], sword)).toBeUndefined();
    expect(typeMismatch(["weaponSimple"], sword)).toBe("not a simple weapon");
  });

  it("refuses nothing in a slot it cannot narrow", () => {
    expect(typeMismatch(["focusSpellcastingArcane"], smith)).toBeUndefined();
    expect(typeMismatch(["setGaming", "somethingNew"], smith)).toBeUndefined();
  });
});
