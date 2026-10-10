import { describe, expect, it } from "vitest";
import {
  ammunitionTraitSchema,
  armorBurdenSchema,
  armorTraitSchema,
  containerTraitSchema,
  type HomebrewItem,
  homebrewItemInputSchema,
  homebrewItemRecordSchema,
  homebrewItemSchema,
  itemRecordSchema,
  weaponTraitSchema,
} from "./index.ts";

const minimal = { name: "Sunblade", source: "Homebrew" };

describe("homebrewItemSchema", () => {
  it("accepts the minimal shape", () => {
    const parsed: HomebrewItem = homebrewItemSchema.parse(minimal);
    expect(parsed).toEqual(minimal);
  });

  it("keeps a field this schema does not model, such as weight or value", () => {
    const withUnmodeledFields = { ...minimal, weight: 3, value: 500, dmg1: "1d8" };
    expect(homebrewItemSchema.parse(withUnmodeledFields)).toEqual(withUnmodeledFields);
  });

  it("accepts reqAttune as a boolean", () => {
    expect(homebrewItemSchema.parse({ ...minimal, reqAttune: true }).reqAttune).toBe(true);
  });

  it("accepts reqAttune as a condition string", () => {
    const withCondition = { ...minimal, reqAttune: "by a spellcaster" };
    expect(homebrewItemSchema.parse(withCondition).reqAttune).toBe("by a spellcaster");
  });

  it("rejects a missing name, naming the failed field", () => {
    const result = homebrewItemSchema.safeParse({ source: "Homebrew" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["name"]);
  });

  it("rejects an empty name rather than accepting a blank catalog key", () => {
    const result = homebrewItemSchema.safeParse({ name: "", source: "Homebrew" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["name"]);
  });

  it("rejects reqAttune written as neither a flag nor a condition", () => {
    const result = homebrewItemSchema.safeParse({ ...minimal, reqAttune: 1 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["reqAttune"]);
  });
});

describe("homebrewItemInputSchema", () => {
  it("accepts a name and an edition without a source", () => {
    const parsed = homebrewItemInputSchema.parse({ name: "Sunblade", edition: "one" });
    expect(parsed).toEqual({ name: "Sunblade", edition: "one" });
  });

  it("rejects an edition outside the two rulesets", () => {
    const result = homebrewItemInputSchema.safeParse({ name: "Sunblade", edition: "3.5" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["edition"]);
  });
});

describe("homebrewItemRecordSchema", () => {
  it("accepts a stored row", () => {
    const record = {
      id: "1",
      name: "Sunblade",
      edition: "one",
      type: null,
      rarity: null,
      requiresAttunement: false,
      json: { name: "Sunblade", source: "HB" },
      createdAt: new Date(0).toISOString(),
    };
    expect(homebrewItemRecordSchema.parse(record)).toEqual(record);
  });
});

describe("itemRecordSchema", () => {
  it("accepts a catalog row, keyed by name and source rather than id", () => {
    const record = {
      name: "Longsword",
      source: "PHB",
      edition: "classic",
      kind: "baseitem",
      type: "M",
      rarity: null,
      requiresAttunement: false,
      json: { name: "Longsword", source: "PHB" },
    };
    expect(itemRecordSchema.parse(record)).toEqual(record);
  });
});

describe("armorBurdenSchema", () => {
  it("reads upstream's string Strength and its Stealth flag", () => {
    expect(armorBurdenSchema.parse({ type: "HA", stealth: true, strength: "15" })).toEqual({
      stealth: true,
      strength: 15,
    });
    expect(armorBurdenSchema.parse({ strength: "13" })).toEqual({
      stealth: false,
      strength: 13,
    });
  });

  it("reads a homebrew row's numeric Strength", () => {
    expect(armorBurdenSchema.parse({ strength: 13 })).toEqual({ stealth: false, strength: 13 });
  });

  it("is undefined for a row stating neither, or a malformed value", () => {
    expect(armorBurdenSchema.parse({ type: "LA", ac: 11 })).toBeUndefined();
    expect(armorBurdenSchema.parse({ stealth: false, strength: null })).toBeUndefined();
    expect(armorBurdenSchema.parse({ strength: "lots" })).toBeUndefined();
  });
});

describe("containerTraitSchema", () => {
  it("reads a weightless bag and sums its compartments", () => {
    expect(
      containerTraitSchema.parse({ containerCapacity: { weight: [20, 20, 80], weightless: true } }),
    ).toEqual({ weightless: true, weight: 120, items: {} });
  });

  it("sums the most of each named thing across compartments", () => {
    expect(
      containerTraitSchema.parse({
        containerCapacity: { item: [{ "Arrow|PHB": 60 }, { "arrow|phb": 20, "javelin|phb": 18 }] },
      }),
    ).toEqual({ weightless: false, items: { "arrow|phb": 80, "javelin|phb": 18 } });
  });

  it("is undefined for a row with no capacity, and drops a volume-only one to no limit", () => {
    expect(containerTraitSchema.parse({ weight: 5 })).toBeUndefined();
    expect(containerTraitSchema.parse({ containerCapacity: { volume: [4] } })).toEqual({
      weightless: false,
      items: {},
    });
  });
});

describe("armorTraitSchema", () => {
  it("reads a 2024 row's category from the code before the source suffix", () => {
    expect(armorTraitSchema.parse({ type: "HA|XPHB", ac: 18 })).toEqual({
      category: "heavy",
      armorClass: 18,
    });
  });

  it("adds a magic item's own bonus to its printed armor class", () => {
    expect(armorTraitSchema.parse({ type: "HA", ac: 18, bonusAc: "+2" })).toEqual({
      category: "heavy",
      armorClass: 20,
    });
  });

  it("reads a shield", () => {
    expect(armorTraitSchema.parse({ type: "S", ac: 2 })).toEqual({
      category: "shield",
      armorClass: 2,
    });
  });

  it("is undefined for an item that is not armor, or armor stating no ac", () => {
    expect(armorTraitSchema.parse({ type: "M", ac: 3 })).toBeUndefined();
    expect(armorTraitSchema.parse({ type: "HA" })).toBeUndefined();
    expect(armorTraitSchema.parse({})).toBeUndefined();
  });
});

describe("weaponTraitSchema", () => {
  const noBonus = { attack: 0, damage: 0 };

  it("reads the category and spells out the damage type", () => {
    expect(
      weaponTraitSchema.parse({ weaponCategory: "martial", dmg1: "1d8", dmgType: "S" }),
    ).toEqual({
      category: "martial",
      damage: { dice: "1d8", type: "slashing" },
      kind: "melee",
      bonus: noBonus,
    });
  });

  it("reads the mastery references a row states, and none from a malformed list", () => {
    expect(
      weaponTraitSchema.parse({ weaponCategory: "martial", mastery: ["Topple|XPHB"] }),
    ).toMatchObject({ mastery: ["Topple|XPHB"] });
    expect(weaponTraitSchema.parse({ weaponCategory: "martial", mastery: [] })).not.toHaveProperty(
      "mastery",
    );
    expect(
      weaponTraitSchema.parse({ weaponCategory: "martial", mastery: "Topple" }),
    ).not.toHaveProperty("mastery");
  });

  it("reads the range, the ammunition type and the reload, and none from a malformed value", () => {
    expect(
      weaponTraitSchema.parse({
        weaponCategory: "martial",
        range: "50/150",
        ammoType: "Modern Bullet",
        reload: 15,
      }),
    ).toMatchObject({ range: { normal: 50, long: 150 }, ammoType: "modern bullet", reload: 15 });
    const malformed = weaponTraitSchema.parse({
      weaponCategory: "martial",
      range: "far",
      reload: 0,
    });
    expect(malformed).not.toHaveProperty("range");
    expect(malformed).not.toHaveProperty("reload");
    expect(malformed).not.toHaveProperty("ammoType");
  });

  it("keeps a code it does not know, and a die with no type", () => {
    expect(weaponTraitSchema.parse({ dmg1: "1d6", dmgType: "Z" })).toMatchObject({
      category: null,
      damage: { dice: "1d6", type: "Z" },
    });
    expect(weaponTraitSchema.parse({ weaponCategory: "simple" })).toMatchObject({
      category: "simple",
      damage: null,
    });
  });

  it("reads what an attack needs off a versatile weapon, as Longsword (XPHB) writes it", () => {
    expect(
      weaponTraitSchema.parse({
        type: "M|XPHB",
        weaponCategory: "martial",
        property: ["V|XPHB"],
        dmg1: "1d8",
        dmg2: "1d10",
        dmgType: "S",
      }),
    ).toMatchObject({ kind: "melee", properties: ["V|XPHB"], versatileDamage: "1d10" });
  });

  it("reads a ranged weapon off its type code alone", () => {
    expect(weaponTraitSchema.parse({ type: "R|XPHB", dmg1: "1d6" })?.kind).toBe("ranged");
    expect(weaponTraitSchema.parse({ type: "SCF", dmg1: "1d6" })?.kind).toBe("melee");
  });

  it("names the weapon a named magic item is built on, as Dagger of Venom (DMG) states it", () => {
    expect(weaponTraitSchema.parse({ dmg1: "1d4", baseItem: "dagger|phb" })?.baseName).toBe(
      "dagger",
    );
    expect(weaponTraitSchema.parse({ dmg1: "1d4" })).not.toHaveProperty("baseName");
  });

  it("names a staff a quarterstaff, as Staff of Power (DMG) states no base item", () => {
    expect(
      weaponTraitSchema.parse({ weaponCategory: "simple", staff: true, dmg1: "1d6" })?.baseName,
    ).toBe("quarterstaff");
  });

  it("sums a magic weapon's bonus into each roll it names", () => {
    expect(
      weaponTraitSchema.parse({ dmg1: "1d8", bonusWeapon: "+1", bonusWeaponAttack: "+2" })?.bonus,
    ).toEqual({ attack: 3, damage: 1 });
    expect(weaponTraitSchema.parse({ dmg1: "1d8", bonusWeaponDamage: "+2" })?.bonus).toEqual({
      attack: 0,
      damage: 2,
    });
  });

  it("degrades a malformed bonus or property list to none rather than dropping the weapon", () => {
    expect(
      weaponTraitSchema.parse({ dmg1: "1d8", bonusWeapon: "one", property: "F" }),
    ).toMatchObject({ bonus: noBonus, damage: { dice: "1d8" } });
  });

  it("is undefined for an item that states neither", () => {
    expect(weaponTraitSchema.parse({ type: "G" })).toBeUndefined();
  });
});

describe("ammunitionTraitSchema", () => {
  it("reads a pack's contents, lowercased, and leaves loose ammunition to name itself", () => {
    expect(
      ammunitionTraitSchema.parse({
        type: "A",
        packContents: [{ item: "Arrow|PHB", quantity: 20 }],
      }),
    ).toEqual({ contents: [{ uid: "arrow|phb", count: 20 }] });
    expect(ammunitionTraitSchema.parse({ type: "AF|DMG" })).toEqual({ contents: undefined });
  });

  it("reads nothing from a row that is not ammunition", () => {
    expect(ammunitionTraitSchema.parse({ type: "M" })).toBeUndefined();
    expect(ammunitionTraitSchema.parse({})).toBeUndefined();
  });
});
