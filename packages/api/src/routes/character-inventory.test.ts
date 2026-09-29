import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CharacterInventory } from "@dnd/catalog";
import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { insertCharacter } from "../db/queries/characters.ts";
import { publishDerivedFixture } from "../db/queries/contentFixture.ts";
import { insertHomebrewItem, updateHomebrewItem } from "../db/queries/homebrew.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { characterInventoryRoutes } from "./character-inventory.ts";

const LONGSWORD = { name: "Longsword", source: "PHB" };
const NET = { name: "Net", source: "PHB" };
const PLUS_ONE = { name: "+1 Weapon", source: "DMG" };
const CLOAK = { name: "Cloak of Protection", source: "DMG" };
const CHAIN_MAIL = { name: "Chain Mail", source: "XPHB" };

const row = (
  ref: { name: string; source: string },
  kind: string,
  json: object,
  columns: { rarity?: string; requires_attunement?: 0 | 1 } = {},
) => ({
  ...ref,
  edition: "classic",
  kind,
  type: null,
  rarity: columns.rarity ?? null,
  requires_attunement: columns.requires_attunement ?? 0,
  json: JSON.stringify({ ...ref, ...json }),
});

const withInventory = (inventory: object[]): CharacterDefinition =>
  characterDefinitionSchema.parse({
    name: "Vex",
    edition: "classic",
    levels: [{ class: { name: "Fighter", source: "PHB" } }],
    race: { name: "Elf", source: "PHB" },
    background: { name: "Soldier", source: "PHB" },
    abilityScores: { str: 16, dex: 14, con: 14, int: 12, wis: 10, cha: 8 },
    proficiencies: {
      savingThrows: [],
      skills: [],
      armor: [],
      weapons: [],
      tools: [],
      languages: [],
    },
    inventory,
    spells: [],
  });

describe("characterInventoryRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof characterInventoryRoutes>;

  const store = (definition: CharacterDefinition) =>
    insertCharacter(opened.charactersDb, { id: "1", definition });

  const items = async (): Promise<CharacterInventory["items"]> => {
    const res = await routes.request("/characters/1/inventory");
    expect(res.status).toBe(200);
    return (await res.json()).items;
  };

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "character-inventory-"));
    const itemType = (name: string, label: string) => ({
      kind: "itemType",
      name,
      source: "PHB",
      edition: "classic",
      json: JSON.stringify({ name: label, abbreviation: name }),
    });
    const items = [
      row(LONGSWORD, "baseitem", {
        type: "M",
        weapon: true,
        weaponCategory: "martial",
        dmg1: "1d8",
        dmgType: "S",
        value: 1500,
        weight: 3,
        entries: ["A {@b sharp} blade."],
      }),
      row(NET, "baseitem", { weapon: true, net: true, weight: 3 }),
      row(CHAIN_MAIL, "baseitem", { type: "HA|XPHB", armor: true, ac: 16, value: 7500 }),
      row(PLUS_ONE, "magicvariant", {
        requires: [{ weapon: true }],
        excludes: { net: true },
        inherits: {
          namePrefix: "+1 ",
          source: "DMG",
          rarity: "uncommon",
          entries: ["A +1 bonus to attack and damage rolls."],
        },
      }),
      row(
        CLOAK,
        "item",
        { reqAttune: true, entries: ["A +1 bonus to AC."] },
        { rarity: "uncommon", requires_attunement: 1 },
      ),
    ];
    publishDerivedFixture(dataDir, {
      items,
      lookups: [itemType("M", "Melee Weapon"), itemType("HA", "Heavy Armor")],
    });
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    opened = openTestDatabases();
    routes = characterInventoryRoutes(opened.charactersDb, dataDir, opened.homebrewDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
  });

  it("404s an id that names no character", async () => {
    const res = await routes.request("/characters/nobody/inventory");
    expect(res.status).toBe(404);
  });

  it("resolves a catalog item with its flags, weight and text", async () => {
    store(withInventory([{ ref: CLOAK, equipped: true, attuned: true }, { ref: LONGSWORD }]));
    expect(await items()).toEqual([
      {
        resolved: true,
        ...CLOAK,
        quantity: 1,
        carried: true,
        equipped: true,
        attuned: true,
        type: null,
        rarity: "uncommon",
        requiresAttunement: true,
        weight: null,
        value: null,
        weapon: null,
        armor: null,
        entries: ["A +1 bonus to AC."],
      },
      expect.objectContaining({ name: "Longsword", weight: 3, attuned: false }),
    ]);
  });

  it("carries a weapon's and an armor's printed numbers, and names the item's type", async () => {
    store(withInventory([{ ref: LONGSWORD }, { ref: CHAIN_MAIL }]));
    const [sword, mail] = await items();
    expect(sword).toMatchObject({
      type: { abbreviation: "M", name: "Melee Weapon" },
      value: 1500,
      weapon: { category: "martial", damage: { dice: "1d8", type: "slashing" } },
      armor: null,
    });
    expect(mail).toMatchObject({
      type: { abbreviation: "HA", name: "Heavy Armor" },
      value: 7500,
      weapon: null,
      armor: { category: "heavy", armorClass: 16 },
    });
  });

  it("names a magic variant the way its expansion does, not by joining two names", async () => {
    store(withInventory([{ ref: LONGSWORD, variant: PLUS_ONE, quantity: 2 }]));
    const [sword] = await items();
    expect(sword).toMatchObject({
      resolved: true,
      name: "+1 Longsword",
      source: "DMG",
      quantity: 2,
      type: { abbreviation: "M", name: "Melee Weapon" },
      rarity: "uncommon",
      weight: 3,
      weapon: { category: "martial", damage: { dice: "1d8", type: "slashing" } },
    });
  });

  it("lists a variant its base item refuses as unresolved, naming both", async () => {
    store(withInventory([{ ref: NET, variant: PLUS_ONE }]));
    expect(await items()).toEqual([
      {
        resolved: false,
        ...NET,
        variant: PLUS_ONE,
        quantity: 1,
        carried: true,
        equipped: false,
        attuned: false,
      },
    ]);
  });

  it("resolves a homebrew item with no source, and keeps a missing one listed", async () => {
    insertHomebrewItem(opened.homebrewDb, "i", {
      name: "Lucky Coin",
      edition: "classic",
      weight: 0.02,
      entries: ["Warm to the touch."],
    });
    store(
      withInventory([
        { ref: { homebrewId: "i" } },
        { ref: { homebrewId: "gone" } },
        { ref: { name: "Lost", source: "PHB" }, carried: false },
      ]),
    );
    const [coin, gone, lost] = await items();

    expect(coin).toMatchObject({ resolved: true, name: "Lucky Coin", weight: 0.02, type: null });
    expect(coin).not.toHaveProperty("source");
    expect(gone).toEqual(expect.objectContaining({ resolved: false, name: "Homebrew" }));
    expect(gone).not.toHaveProperty("source");
    expect(lost).toEqual(
      expect.objectContaining({ resolved: false, name: "Lost", source: "PHB", carried: false }),
    );
  });

  it("keeps holding a homebrew item through a rename, since it holds the id", async () => {
    insertHomebrewItem(opened.homebrewDb, "i", { name: "Lucky Coin", edition: "classic" });
    store(withInventory([{ ref: { homebrewId: "i" } }]));

    updateHomebrewItem(opened.homebrewDb, "i", { name: "Cursed Coin", edition: "classic" });

    expect(await items()).toEqual([
      expect.objectContaining({ resolved: true, name: "Cursed Coin" }),
    ]);
  });
});
