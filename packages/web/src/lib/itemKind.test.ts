import { describe, expect, it } from "vitest";
import { itemMeta } from "./itemKind.ts";

describe("itemMeta", () => {
  it("leads with the kind, a weapon's category folded in, then the rarity", () => {
    expect(itemMeta({ kinds: ["ranged"], rarity: "uncommon", category: "martial" })).toBe(
      "Martial ranged weapon • Uncommon",
    );
    expect(itemMeta({ kinds: ["ring"], rarity: "very rare", category: null })).toBe(
      "Ring • Very rare",
    );
  });

  it("leaves off a mundane item's rarity and leads with its type code's kind of two", () => {
    expect(itemMeta({ kinds: ["melee", "staff"], rarity: "none", category: "simple" })).toBe(
      "Simple melee weapon",
    );
    expect(itemMeta({ kinds: ["tool", "wondrous"], rarity: "rare", category: null })).toBe(
      "Tool or instrument • Rare",
    );
    expect(itemMeta({ kinds: ["wondrous"], rarity: null, category: null })).toBe("Wondrous item");
  });
});
