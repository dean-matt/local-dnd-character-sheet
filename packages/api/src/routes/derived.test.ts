import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type CharacterDefinition,
  type CharacterDerived,
  characterDefinitionSchema,
} from "@dnd/character";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { z } from "zod";
import { openDatabases } from "../db/client.ts";
import { insertCharacter } from "../db/queries/characters.ts";
import { publishDerivedFixture } from "../db/queries/contentFixture.ts";
import {
  insertHomebrewClass,
  insertHomebrewItem,
  insertHomebrewRace,
} from "../db/queries/homebrew.ts";
import { derivedRoutes } from "./derived.ts";

const FIGHTER = { name: "Fighter", source: "PHB" };
const ELF = { name: "Elf", source: "PHB" };
const PLATE = { name: "Plate Armor", source: "PHB" };
const SHIELD = { name: "Shield", source: "PHB" };
const PLUS_ONE = { name: "+1 Armor", source: "DMG" };

const item = (ref: { name: string; source: string }, kind: string, json: object) => ({
  ...ref,
  edition: "classic",
  kind,
  type: null,
  rarity: null,
  requires_attunement: 0 as const,
  json: JSON.stringify({ ...ref, ...json }),
});

const skill = (name: string, source: string, edition: string, ability: string) => ({
  kind: "skill",
  name,
  source,
  edition,
  json: JSON.stringify({ name, source, ability }),
});

const definitionWith = (
  overrides: Partial<z.input<typeof characterDefinitionSchema>> = {},
): CharacterDefinition =>
  characterDefinitionSchema.parse({
    name: "Vex",
    edition: "classic",
    levels: [
      { class: FIGHTER },
      { class: FIGHTER },
      { class: FIGHTER, subclass: { name: "Eldritch Knight", source: "PHB" } },
    ],
    race: ELF,
    subrace: { name: "Wood", source: "PHB" },
    background: { name: "Soldier", source: "PHB" },
    abilityScores: { str: 16, dex: 14, con: 14, int: 12, wis: 10, cha: 8 },
    proficiencies: {
      savingThrows: ["str", "con"],
      skills: [],
      armor: [],
      weapons: [],
      tools: [],
      languages: [],
    },
    inventory: [
      { ref: PLATE, equipped: true },
      { ref: SHIELD, equipped: true },
    ],
    spells: [],
    ...overrides,
  });

describe("derivedRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openDatabases>;
  let routes: ReturnType<typeof derivedRoutes>;

  const store = (definition: CharacterDefinition) =>
    insertCharacter(opened.charactersDb, { id: "1", definition });

  const derived = async (): Promise<CharacterDerived> => {
    const res = await routes.request("/characters/1/derived");
    expect(res.status).toBe(200);
    return res.json();
  };

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "derived-routes-"));
    opened = openDatabases(dataDir);
    routes = derivedRoutes(opened.charactersDb, dataDir, opened.homebrewDb);
    publishDerivedFixture(dataDir, {
      classes: [{ ...FIGHTER, edition: "classic", hit_die: 10, json: JSON.stringify(FIGHTER) }],
      subclasses: [
        {
          name: "Eldritch Knight",
          source: "PHB",
          short_name: "Eldritch Knight",
          class_name: "Fighter",
          class_source: "PHB",
          edition: "classic",
          json: JSON.stringify({ name: "Eldritch Knight", spellcastingAbility: "int" }),
        },
      ],
      races: [{ ...ELF, edition: "classic", json: JSON.stringify({ size: ["M"], speed: 30 }) }],
      subraces: [
        {
          name: "Wood",
          source: "PHB",
          race_name: "Elf",
          race_source: "PHB",
          edition: "classic",
          json: JSON.stringify({ size: ["M"], speed: 35 }),
        },
      ],
      items: [
        item(PLATE, "baseitem", { type: "HA", ac: 18, armor: true }),
        item(SHIELD, "baseitem", { type: "S", ac: 2 }),
        item(PLUS_ONE, "magicvariant", {
          type: "GV",
          requires: [{ armor: true }],
          inherits: { namePrefix: "+1 ", source: "DMG", bonusAc: "+1" },
        }),
      ],
      lookups: [
        skill("Athletics", "PHB", "classic", "str"),
        skill("Athletics", "XPHB", "one", "str"),
        skill("Stealth", "PHB", "classic", "dex"),
      ],
    });
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("404s an id that names no character", async () => {
    const res = await routes.request("/characters/nobody/derived");
    expect(res.status).toBe(404);
  });

  it("derives the block from the catalog rows the character names", async () => {
    store(definitionWith());
    const block = await derived();

    expect(block.hitPointMaximum.computed).toBe(10 + 6 + 6 + 3 * 2);
    expect(block.armorClass.computed).toBe(20);
    expect(block.size.computed).toBe("medium");
    expect(block.speed.computed).toEqual({ walk: 35 });
    expect(block.spellcasting).toEqual([
      expect.objectContaining({ class: FIGHTER, ability: "int" }),
    ]);
    expect(block.skills.map((entry) => entry.ref)).toEqual([
      { name: "Athletics", source: "PHB" },
      { name: "Stealth", source: "PHB" },
    ]);
  });

  it("adds an equipped magic variant's bonus to its base item's armor class", async () => {
    store(definitionWith({ inventory: [{ ref: PLATE, variant: PLUS_ONE, equipped: true }] }));
    expect((await derived()).armorClass.computed).toBe(19);
  });

  it("reads an equipped item that resolves to nothing as unarmored", async () => {
    store(
      definitionWith({ inventory: [{ ref: { name: "Lost", source: "PHB" }, equipped: true }] }),
    );
    expect((await derived()).armorClass.computed).toBe(10 + 2);
  });

  it("422s a class that resolves to nothing, naming it", async () => {
    store(definitionWith({ levels: [{ class: { name: "Wizard", source: "PHB" } }] }));
    const res = await routes.request("/characters/1/derived");

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "No class Wizard (PHB)" });
  });

  it("422s a race that resolves to nothing", async () => {
    store(definitionWith({ subrace: { name: "Drow", source: "PHB" } }));
    const res = await routes.request("/characters/1/derived");

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "No race Drow (PHB)" });
  });

  it("reads a race taken with no subrace from the race row", async () => {
    store(definitionWith({ subrace: undefined }));
    expect((await derived()).speed.computed).toEqual({ walk: 30 });
  });

  it("422s a class whose hit die no rule recognizes", async () => {
    insertHomebrewClass(opened.homebrewDb, "c", {
      name: "Titan",
      edition: "classic",
      hd: { number: 1, faces: 20 },
    });
    store(definitionWith({ levels: [{ class: { homebrewId: "c" } }] }));
    const res = await routes.request("/characters/1/derived");

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "Class homebrew c has a d20 hit die" });
  });

  it("422s a race row that states no size or speed, naming that row", async () => {
    insertHomebrewRace(opened.homebrewDb, "r", { name: "Wisp", edition: "classic" });
    store(definitionWith({ race: { homebrewId: "r" }, subrace: undefined }));
    const res = await routes.request("/characters/1/derived");

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "Race homebrew r states no size or speed" });
  });

  it("resolves a homebrew class, race and item", async () => {
    insertHomebrewClass(opened.homebrewDb, "c", {
      name: "Hexblade",
      edition: "classic",
      hd: { number: 1, faces: 8 },
      spellcastingAbility: "cha",
    });
    insertHomebrewRace(opened.homebrewDb, "r", {
      name: "Sprite",
      edition: "classic",
      size: ["T"],
      speed: { walk: 10, fly: 40 },
    });
    insertHomebrewItem(opened.homebrewDb, "i", {
      name: "Bark Mail",
      edition: "classic",
      type: "MA",
      ac: 14,
    });
    store(
      definitionWith({
        levels: [{ class: { homebrewId: "c" } }],
        race: { homebrewId: "r" },
        subrace: undefined,
        inventory: [{ ref: { homebrewId: "i" }, equipped: true }],
      }),
    );
    const block = await derived();

    expect(block.hitPointMaximum.computed).toBe(8 + 2);
    expect(block.size.computed).toBe("tiny");
    expect(block.speed.computed).toEqual({ walk: 10, fly: 40 });
    expect(block.armorClass.computed).toBe(14 + 2);
    expect(block.spellcasting).toEqual([
      expect.objectContaining({ class: { homebrewId: "c" }, ability: "cha" }),
    ]);
  });
});
