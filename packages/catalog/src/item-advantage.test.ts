import { describe, expect, it } from "vitest";
import { homebrewItemSchema } from "./item.ts";
import { ITEM_ADVANTAGES, itemAdvantageSchema, itemAdvantagesOf } from "./item-advantage.ts";

describe("itemAdvantageSchema", () => {
  it("reads an unconditional and a conditional effect", () => {
    expect(
      itemAdvantageSchema.parse({ mode: "advantage", roll: "skill", target: "Stealth" }),
    ).toEqual({ mode: "advantage", roll: "skill", target: "Stealth" });
    expect(
      itemAdvantageSchema.parse({ mode: "advantage", roll: "save", condition: "against spells" }),
    ).toEqual({ mode: "advantage", roll: "save", condition: "against spells" });
  });

  it("requires a skill to name its skill, and an attack to name nothing", () => {
    expect(itemAdvantageSchema.safeParse({ mode: "advantage", roll: "skill" }).success).toBe(false);
    expect(
      itemAdvantageSchema.safeParse({ mode: "advantage", roll: "attack", target: "str" }).success,
    ).toBe(false);
  });

  it("limits a save or check to an ability", () => {
    expect(
      itemAdvantageSchema.safeParse({ mode: "advantage", roll: "save", target: "str" }).success,
    ).toBe(true);
    expect(
      itemAdvantageSchema.safeParse({ mode: "advantage", roll: "check", target: "Stealth" })
        .success,
    ).toBe(false);
  });

  it("refuses an unknown field, so a typo cannot pass as a condition", () => {
    expect(
      itemAdvantageSchema.safeParse({ mode: "advantage", roll: "save", when: "against spells" })
        .success,
    ).toBe(false);
  });

  it("is what a homebrew item states its own effects with", () => {
    const item = {
      name: "Cloak",
      source: "HB",
      advantage: [{ mode: "disadvantage", roll: "attack" }],
    };
    expect(homebrewItemSchema.parse(item).advantage).toEqual([
      { mode: "disadvantage", roll: "attack" },
    ]);
    expect(homebrewItemSchema.safeParse({ ...item, advantage: [{ roll: "attack" }] }).success).toBe(
      false,
    );
  });
});

describe("ITEM_ADVANTAGES", () => {
  it("lists each (name, source) once", () => {
    const keys = ITEM_ADVANTAGES.map(({ name, source }) => `${name}|${source}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("holds only effects the schema accepts, each with a short condition", () => {
    for (const { name, effects } of ITEM_ADVANTAGES) {
      expect(effects.length, name).toBeGreaterThan(0);
      for (const effect of effects) {
        expect(itemAdvantageSchema.safeParse(effect).success, name).toBe(true);
        expect(effect.condition?.length ?? 0, name).toBeLessThanOrEqual(80);
      }
    }
  });

  it("finds an item by name and source, in either edition", () => {
    expect(itemAdvantagesOf("Mantle of Spell Resistance", "DMG")).toEqual([
      { mode: "advantage", roll: "save", condition: "against spells" },
    ]);
    expect(itemAdvantagesOf("Mantle of Spell Resistance", "XDMG")).toHaveLength(1);
    expect(itemAdvantagesOf("Mantle of Spell Resistance", "PHB")).toEqual([]);
    expect(itemAdvantagesOf("Longsword", "PHB")).toEqual([]);
  });

  it("gives an item every group that names it", () => {
    expect(itemAdvantagesOf("Infiltrator's Key (Exalted)", "EGW").map((e) => e.roll)).toEqual([
      "check",
      "skill",
    ]);
  });
});
