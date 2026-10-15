import { describe, expect, it } from "vitest";
import { addableAt, addableHit } from "./addable.ts";

describe("addableHit", () => {
  it("adds an item, a spell or a feat by its reference, homebrew by id", () => {
    expect(
      addableHit({ type: "spell", name: "Fireball", source: "PHB", edition: "classic" }),
    ).toEqual({ kind: "spell", ref: { name: "Fireball", source: "PHB" }, label: "Fireball (PHB)" });
    expect(addableHit({ type: "item", id: "3", name: "Ember Charm", edition: "one" })).toEqual({
      kind: "item",
      ref: { homebrewId: "3" },
      label: "Ember Charm (Homebrew)",
    });
  });

  it("adds nothing creation or level-up owns", () => {
    expect(
      addableHit({ type: "race", name: "Elf", source: "XPHB", edition: "one" }),
    ).toBeUndefined();
  });
});

describe("addableAt", () => {
  it("reads a catalog row's reference off its detail address, decoded", () => {
    expect(addableAt("/feats/Elemental%20Adept/PHB", "Elemental Adept", "PHB")).toEqual({
      kind: "feat",
      ref: { name: "Elemental Adept", source: "PHB" },
      label: "Elemental Adept (PHB)",
    });
  });

  it("reads a magic variant over its base item as the pair the inventory stores", () => {
    expect(
      addableAt("/items/Longsword/PHB/variants/%2B1%20Weapon/DMG", "+1 Longsword", "DMG"),
    ).toEqual({
      kind: "item",
      ref: { name: "Longsword", source: "PHB" },
      variant: { name: "+1 Weapon", source: "DMG" },
      label: "+1 Longsword (DMG)",
    });
  });

  it("reads a homebrew row by id, and nothing from an address naming anything else", () => {
    expect(addableAt("/homebrew/spells/hb_1", "Frostbite", undefined)?.ref).toEqual({
      homebrewId: "hb_1",
    });
    expect(addableAt("/races/Elf/XPHB", "Elf", "XPHB")).toBeUndefined();
    expect(addableAt("/homebrew/races/hb_2", "Elf", undefined)).toBeUndefined();
    expect(addableAt("/catalog/condition/Blinded/XPHB", "Blinded", "XPHB")).toBeUndefined();
  });
});
