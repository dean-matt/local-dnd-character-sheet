import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { publishItems } from "./contentFixture.ts";
import { baseItemMatchesVariant, expandItemFields, getExpandedItem } from "./item-variant.ts";

const LONGSWORD_FIELDS = {
  name: "Longsword",
  source: "XPHB",
  page: 220,
  srd: true,
  edition: "one",
  type: "M",
  rarity: "none",
  weight: 3,
  value: 1500,
  weaponCategory: "martial",
  property: ["V"],
  dmg1: "1d8",
  dmgType: "S",
  dmg2: "1d10",
  sword: true,
  weapon: true,
};

const LONGSWORD_ROW = {
  name: "Longsword",
  source: "XPHB",
  edition: "one",
  kind: "baseitem",
  type: "M",
  rarity: "none",
  requires_attunement: 0 as const,
  json: JSON.stringify(LONGSWORD_FIELDS),
};

const NET_FIELDS = {
  name: "Net",
  source: "XPHB",
  page: 220,
  type: "NET|XPHB",
  rarity: "none",
  weight: 3,
  value: 100,
  weaponCategory: "martial",
  net: true,
  weapon: true,
};

const NET_ROW = {
  name: "Net",
  source: "XPHB",
  edition: "one",
  kind: "baseitem",
  type: "NET|XPHB",
  rarity: "none",
  requires_attunement: 0 as const,
  json: JSON.stringify(NET_FIELDS),
};

const PLUS_ONE_WEAPON_FIELDS = {
  name: "+1 Weapon",
  type: "GV|XDMG",
  edition: "one",
  requires: [{ weapon: true }],
  excludes: { net: true },
  inherits: {
    namePrefix: "+1 ",
    source: "XDMG",
    page: 348,
    rarity: "uncommon",
    reqAttune: false,
    bonusWeapon: "+1",
    entries: ["You have a +1 bonus to attack and damage rolls made with this weapon."],
  },
};

const PLUS_ONE_WEAPON_ROW = {
  name: "+1 Weapon",
  source: "XDMG",
  edition: "one",
  kind: "magicvariant",
  type: null,
  rarity: "uncommon",
  requires_attunement: 0 as const,
  json: JSON.stringify(PLUS_ONE_WEAPON_FIELDS),
};

const ADAMANTINE_WEAPON_FIELDS = {
  name: "Adamantine Weapon",
  type: "GV|DMG",
  edition: "classic",
  requires: [{ weapon: true }],
  excludes: { net: true },
  inherits: {
    source: "DMG",
    page: 150,
    rarity: "uncommon",
    valueExpression: "[[baseItem.value]] + 50000",
    entries: ["This weapon is made of adamantine."],
  },
};

const ADAMANTINE_WEAPON_ROW = {
  name: "Adamantine Weapon",
  source: "DMG",
  edition: "classic",
  kind: "magicvariant",
  type: null,
  rarity: "uncommon",
  requires_attunement: 0 as const,
  json: JSON.stringify(ADAMANTINE_WEAPON_FIELDS),
};

describe("baseItemMatchesVariant", () => {
  it("matches a base item any one requires alternative allows", () => {
    expect(baseItemMatchesVariant(LONGSWORD_FIELDS, PLUS_ONE_WEAPON_FIELDS)).toBe(true);
  });

  it("refuses a base item requires names but excludes also names", () => {
    expect(baseItemMatchesVariant(NET_FIELDS, PLUS_ONE_WEAPON_FIELDS)).toBe(false);
  });

  it("refuses a base item no requires alternative matches", () => {
    const armorOnly = { requires: [{ armor: true }], inherits: {} };
    expect(baseItemMatchesVariant(LONGSWORD_FIELDS, armorOnly)).toBe(false);
  });

  it("ANDs the keys inside one requires alternative, matching name and source together", () => {
    const named = { requires: [{ name: "Longsword", source: "PHB" }], inherits: {} };
    expect(baseItemMatchesVariant(LONGSWORD_FIELDS, named)).toBe(false);
    expect(baseItemMatchesVariant({ ...LONGSWORD_FIELDS, source: "PHB" }, named)).toBe(true);
  });

  it("throws where requires is missing, rather than silently matching everything", () => {
    expect(() => baseItemMatchesVariant(LONGSWORD_FIELDS, { inherits: {} })).toThrow();
  });
});

describe("expandItemFields", () => {
  it("builds the name from namePrefix rather than string concatenation at the call site", () => {
    const merged = expandItemFields(LONGSWORD_FIELDS, PLUS_ONE_WEAPON_FIELDS.inherits);
    expect(merged.name).toBe("+1 Longsword");
  });

  it("takes source, rarity and attunement from inherits", () => {
    const merged = expandItemFields(LONGSWORD_FIELDS, PLUS_ONE_WEAPON_FIELDS.inherits);
    expect(merged.source).toBe("XDMG");
    expect(merged.rarity).toBe("uncommon");
    expect(merged.reqAttune).toBe(false);
  });

  it("keeps the base item's own fields where inherits says nothing", () => {
    const merged = expandItemFields(LONGSWORD_FIELDS, PLUS_ONE_WEAPON_FIELDS.inherits);
    expect(merged.weaponCategory).toBe("martial");
    expect(merged.property).toEqual(["V"]);
    expect(merged.dmgType).toBe("S");
    expect(merged.type).toBe("M");
  });

  it("drops the base item's mundane value rather than pricing a magic item like plain steel", () => {
    const merged = expandItemFields(LONGSWORD_FIELDS, PLUS_ONE_WEAPON_FIELDS.inherits);
    expect(merged.value).toBeUndefined();
  });

  it("evaluates a valueExpression against the base item's own value", () => {
    const merged = expandItemFields(LONGSWORD_FIELDS, ADAMANTINE_WEAPON_FIELDS.inherits);
    expect(merged.value).toBe(51500);
  });

  it("leaves value unset rather than throwing where the base item carries none", () => {
    const { value: _value, ...noValue } = LONGSWORD_FIELDS;
    const merged = expandItemFields(noValue, ADAMANTINE_WEAPON_FIELDS.inherits);
    expect(merged.value).toBeUndefined();
  });

  it("drops the base item's page and srd flag, which the variant restates rather than inherits", () => {
    const merged = expandItemFields(LONGSWORD_FIELDS, PLUS_ONE_WEAPON_FIELDS.inherits);
    expect(merged.page).toBe(348);
    expect(merged.srd).toBeUndefined();
  });

  it("applies nameRemove before namePrefix and nameSuffix, whatever order inherits wrote them", () => {
    const merged = expandItemFields(
      { name: "Very Rare Reagent" },
      { nameSuffix: "Poisonous Reagent", nameRemove: "Reagent" },
    );
    expect(merged.name).toBe("Very Rare Poisonous Reagent");
  });
});

describe("getExpandedItem", () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "item-variant-"));
    publishItems(dataDir, [LONGSWORD_ROW, NET_ROW, PLUS_ONE_WEAPON_ROW, ADAMANTINE_WEAPON_ROW]);
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("expands a base item and a magic variant into the specific item they make", () => {
    const row = getExpandedItem(
      dataDir,
      { name: "Longsword", source: "XPHB" },
      { name: "+1 Weapon", source: "XDMG" },
    );
    expect(row).toMatchObject({
      name: "+1 Longsword",
      source: "XDMG",
      edition: "one",
      kind: "item",
      rarity: "uncommon",
      requires_attunement: 0,
    });
  });

  it("returns undefined where the base item names no row", () => {
    const row = getExpandedItem(
      dataDir,
      { name: "Nonexistent", source: "XPHB" },
      { name: "+1 Weapon", source: "XDMG" },
    );
    expect(row).toBeUndefined();
  });

  it("returns undefined where the variant names no row", () => {
    const row = getExpandedItem(
      dataDir,
      { name: "Longsword", source: "XPHB" },
      { name: "Nonexistent", source: "XDMG" },
    );
    expect(row).toBeUndefined();
  });

  it("returns undefined, not a throw, where the base and variant path segments are swapped", () => {
    const row = getExpandedItem(
      dataDir,
      { name: "+1 Weapon", source: "XDMG" },
      { name: "Longsword", source: "XPHB" },
    );
    expect(row).toBeUndefined();
  });

  it("returns null, not an expanded item, where the variant refuses the base item", () => {
    const row = getExpandedItem(
      dataDir,
      { name: "Net", source: "XPHB" },
      { name: "+1 Weapon", source: "XDMG" },
    );
    expect(row).toBeNull();
  });
});
