import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CharacterInventory } from "@dnd/catalog";
import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabases } from "../db/client.ts";
import { insertCharacter } from "../db/queries/characters.ts";
import { publishItems } from "../db/queries/contentFixture.ts";
import { insertHomebrewItem } from "../db/queries/homebrew.ts";
import { characterInventoryRoutes } from "./character-inventory.ts";

const LONGSWORD = { name: "Longsword", source: "PHB" };
const NET = { name: "Net", source: "PHB" };
const PLUS_ONE = { name: "+1 Weapon", source: "DMG" };
const CLOAK = { name: "Cloak of Protection", source: "DMG" };

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
  let opened: ReturnType<typeof openDatabases>;
  let routes: ReturnType<typeof characterInventoryRoutes>;

  const store = (definition: CharacterDefinition) =>
    insertCharacter(opened.charactersDb, { id: "1", definition });

  const items = async (): Promise<CharacterInventory["items"]> => {
    const res = await routes.request("/characters/1/inventory");
    expect(res.status).toBe(200);
    return (await res.json()).items;
  };

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "character-inventory-"));
    opened = openDatabases(dataDir);
    routes = characterInventoryRoutes(opened.charactersDb, dataDir, opened.homebrewDb);
    publishItems(dataDir, [
      row(LONGSWORD, "baseitem", { weapon: true, weight: 3, entries: ["A {@b sharp} blade."] }),
      row(NET, "baseitem", { weapon: true, net: true, weight: 3 }),
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
    ]);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
    rmSync(dataDir, { recursive: true, force: true });
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
        rarity: "uncommon",
        requiresAttunement: true,
        weight: null,
        entries: ["A +1 bonus to AC."],
      },
      expect.objectContaining({ name: "Longsword", weight: 3, attuned: false }),
    ]);
  });

  it("names a magic variant the way its expansion does, not by joining two names", async () => {
    store(withInventory([{ ref: LONGSWORD, variant: PLUS_ONE, quantity: 2 }]));
    const [sword] = await items();
    expect(sword).toMatchObject({
      resolved: true,
      name: "+1 Longsword",
      source: "DMG",
      quantity: 2,
      rarity: "uncommon",
      weight: 3,
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

    expect(coin).toMatchObject({ resolved: true, name: "Lucky Coin", weight: 0.02 });
    expect(coin).not.toHaveProperty("source");
    expect(gone).toEqual(expect.objectContaining({ resolved: false, name: "Homebrew" }));
    expect(gone).not.toHaveProperty("source");
    expect(lost).toEqual(
      expect.objectContaining({ resolved: false, name: "Lost", source: "PHB", carried: false }),
    );
  });
});
