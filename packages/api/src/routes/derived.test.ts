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
import { insertCharacter, updateCharacterDefinition } from "../db/queries/characters.ts";
import { publishDerivedFixture } from "../db/queries/contentFixture.ts";
import {
  insertHomebrewClass,
  insertHomebrewItem,
  insertHomebrewRace,
} from "../db/queries/homebrew.ts";
import { derivedRoutes } from "./derived.ts";

const FIGHTER = { name: "Fighter", source: "PHB" };
const BARBARIAN = { name: "Barbarian", source: "PHB" };
const PALADIN = { name: "Paladin", source: "PHB" };
const WARLOCK = { name: "Warlock", source: "XPHB" };
const ELDRITCH_KNIGHT = { name: "Eldritch Knight", source: "PHB" };
const FIGHTER_ONE = { name: "Fighter", source: "XPHB" };
const ELDRITCH_KNIGHT_ONE = { name: "Eldritch Knight", source: "XPHB" };
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
    levels: [{ class: FIGHTER }, { class: FIGHTER }, { class: FIGHTER, subclass: ELDRITCH_KNIGHT }],
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
      classes: [
        { ...FIGHTER, edition: "classic", hit_die: 10, json: JSON.stringify(FIGHTER) },
        { ...FIGHTER_ONE, edition: "one", hit_die: 10, json: JSON.stringify(FIGHTER_ONE) },
        { ...BARBARIAN, edition: "classic", hit_die: 12, json: JSON.stringify(BARBARIAN) },
        {
          ...PALADIN,
          edition: "classic",
          hit_die: 10,
          json: JSON.stringify({
            ...PALADIN,
            spellcastingAbility: "cha",
            casterProgression: "1/2",
            preparedSpells: "<$level$> / 2 + <$cha_mod$>",
          }),
        },
        {
          ...WARLOCK,
          edition: "one",
          hit_die: 8,
          json: JSON.stringify({
            ...WARLOCK,
            spellcastingAbility: "cha",
            casterProgression: "pact",
          }),
        },
      ],
      classResources: [
        {
          class_name: "Warlock",
          class_source: "XPHB",
          level: 1,
          resource_key: "prepared_spells",
          value: "2",
        },
      ],
      spellSlots: [
        { class_name: "Paladin", class_source: "PHB", level: 2, slot_level: 1, slots: 2 },
        { class_name: "Warlock", class_source: "XPHB", level: 1, slot_level: 1, slots: 1 },
      ],
      subclassResources: [
        {
          class_name: "Fighter",
          class_source: "XPHB",
          subclass_name: "Eldritch Knight",
          subclass_source: "XPHB",
          level: 3,
          resource_key: "prepared_spells",
          value: "3",
        },
      ],
      subclassSpellSlots: [
        {
          class_name: "Fighter",
          class_source: "PHB",
          subclass_name: "Eldritch Knight",
          subclass_source: "PHB",
          level: 3,
          slot_level: 1,
          slots: 2,
        },
      ],
      subclasses: [
        {
          name: "Eldritch Knight",
          source: "PHB",
          short_name: "Eldritch Knight",
          class_name: "Fighter",
          class_source: "PHB",
          edition: "classic",
          json: JSON.stringify({
            name: "Eldritch Knight",
            spellcastingAbility: "int",
            casterProgression: "1/3",
          }),
        },
        {
          ...ELDRITCH_KNIGHT_ONE,
          short_name: "Eldritch Knight",
          class_name: "Fighter",
          class_source: "XPHB",
          edition: "one",
          json: JSON.stringify({
            ...ELDRITCH_KNIGHT_ONE,
            spellcastingAbility: "int",
            casterProgression: "1/3",
          }),
        },
        {
          name: "Path of the Ancestral Guardian",
          source: "XGE",
          short_name: "Ancestral Guardian",
          class_name: "Barbarian",
          class_source: "PHB",
          edition: "classic",
          json: JSON.stringify({
            name: "Path of the Ancestral Guardian",
            spellcastingAbility: "wis",
            additionalSpells: [{ innate: { "10": ["augury", "clairvoyance"] } }],
          }),
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

  it("gives a class its casting ability from its first spell slot", async () => {
    store(definitionWith({ levels: [{ class: PALADIN }] }));
    expect((await derived()).spellcasting).toEqual([]);

    updateCharacterDefinition(
      opened.charactersDb,
      "1",
      definitionWith({ levels: [{ class: PALADIN }, { class: PALADIN }] }),
    );
    expect((await derived()).spellcasting).toEqual([
      expect.objectContaining({ class: PALADIN, ability: "cha" }),
    ]);
  });

  it("gives a subclass its casting ability from the level its first spell arrives", async () => {
    const barbarian = (level: number) =>
      definitionWith({
        levels: Array.from({ length: level }, (_, i) => ({
          class: BARBARIAN,
          ...(i === 2 && { subclass: { name: "Path of the Ancestral Guardian", source: "XGE" } }),
        })),
      });
    store(barbarian(9));
    expect((await derived()).spellcasting).toEqual([]);

    updateCharacterDefinition(opened.charactersDb, "1", barbarian(10));
    expect((await derived()).spellcasting).toEqual([
      expect.objectContaining({ class: BARBARIAN, ability: "wis" }),
    ]);
  });

  it("reads a third caster's slots off its subclass's table", async () => {
    store(definitionWith());
    const block = await derived();
    expect(block.spellSlots).toEqual([
      { level: 1, total: { computed: 2, manual: null, terms: [] } },
    ]);
    expect(block.spellcasting[0]).not.toHaveProperty("preparedSpells");
  });

  it("reads a third caster's printed prepared count off its subclass's table", async () => {
    store(
      definitionWith({
        edition: "one",
        levels: [
          { class: FIGHTER_ONE },
          { class: FIGHTER_ONE },
          { class: FIGHTER_ONE, subclass: ELDRITCH_KNIGHT_ONE },
        ],
      }),
    );
    expect((await derived()).spellcasting[0]?.preparedSpells?.computed).toBe(3);
  });

  it("counts a classic prepared list from the formula the class row prints", async () => {
    store(definitionWith({ levels: [{ class: PALADIN }, { class: PALADIN }] }));
    const [paladin] = (await derived()).spellcasting;
    // Half of level 2, and Charisma 8's -1, floored at one.
    expect(paladin?.preparedSpells?.computed).toBe(1);
  });

  it("reads a printed prepared count and pact slots off the class table", async () => {
    store(definitionWith({ levels: [{ class: WARLOCK }] }));
    const block = await derived();
    expect(block.spellcasting[0]?.preparedSpells?.computed).toBe(2);
    expect(block.pactSlots).toEqual({ level: 1, total: { computed: 1, manual: null, terms: [] } });
    expect(block.spellSlots).toEqual([]);
  });

  it("reads the multiclass table once two classes cast", async () => {
    store(
      definitionWith({
        levels: [
          { class: FIGHTER },
          { class: FIGHTER },
          { class: FIGHTER, subclass: ELDRITCH_KNIGHT },
          { class: PALADIN },
          { class: PALADIN },
        ],
      }),
    );
    // Caster level 1 + 1 = 2, where the two tables summed would give four slots.
    expect((await derived()).spellSlots.map((slot) => slot.total.computed)).toEqual([3]);
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

  it("422s a stored race row that states no size or speed, naming that row", async () => {
    opened.homebrewDb.$client
      .prepare("INSERT INTO homebrew_races (id, edition, name, json) VALUES (?, ?, ?, ?)")
      .run("r", "classic", "Wisp", JSON.stringify({ name: "Wisp", source: "HB" }));
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
