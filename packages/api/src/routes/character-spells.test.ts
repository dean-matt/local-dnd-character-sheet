import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CharacterSpells } from "@dnd/catalog";
import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabases } from "../db/client.ts";
import { insertCharacter } from "../db/queries/characters.ts";
import { publishSpells } from "../db/queries/contentFixture.ts";
import { insertHomebrewSpell } from "../db/queries/homebrew.ts";
import { characterSpellsRoutes } from "./character-spells.ts";

const WIZARD = { name: "Wizard", source: "PHB" };

const SHIELD = {
  name: "Shield",
  source: "PHB",
  level: 1,
  school: "A",
  time: [{ number: 1, unit: "reaction", condition: "which you take when you are hit" }],
  range: { type: "point", distance: { type: "self" } },
  components: { v: true, s: true },
  duration: [{ type: "timed", duration: { type: "round", amount: 1 } }],
  entries: ["An invisible barrier of magical force appears."],
};

const withSpells = (spells: object[]): CharacterDefinition =>
  characterDefinitionSchema.parse({
    name: "Vex",
    edition: "classic",
    levels: [{ class: WIZARD }],
    race: { name: "Elf", source: "PHB" },
    background: { name: "Sage", source: "PHB" },
    abilityScores: { str: 8, dex: 14, con: 12, int: 16, wis: 10, cha: 10 },
    proficiencies: {
      savingThrows: [],
      skills: [],
      armor: [],
      weapons: [],
      tools: [],
      languages: [],
    },
    inventory: [],
    spells,
  });

describe("characterSpellsRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openDatabases>;
  let routes: ReturnType<typeof characterSpellsRoutes>;

  const store = (definition: CharacterDefinition) =>
    insertCharacter(opened.charactersDb, { id: "1", definition });

  const spells = async (): Promise<CharacterSpells["spells"]> => {
    const res = await routes.request("/characters/1/spells");
    expect(res.status).toBe(200);
    return (await res.json()).spells;
  };

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "character-spells-"));
    opened = openDatabases(dataDir);
    routes = characterSpellsRoutes(opened.charactersDb, dataDir, opened.homebrewDb);
    publishSpells(dataDir, [
      {
        name: "Shield",
        source: "PHB",
        edition: "classic",
        level: 1,
        school: "A",
        concentration: 0,
        ritual: 0,
        json: JSON.stringify(SHIELD),
      },
      {
        name: "Detect Magic",
        source: "PHB",
        edition: "classic",
        level: 1,
        school: "D",
        concentration: 1,
        ritual: 1,
        json: JSON.stringify({
          name: "Detect Magic",
          source: "PHB",
          level: 1,
          school: "D",
          time: [{ number: 1, unit: "action" }],
          range: "not a range",
          duration: [{ type: "timed", duration: { type: "minute", amount: 10 } }],
        }),
      },
    ]);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("404s an id that names no character", async () => {
    const res = await routes.request("/characters/nobody/spells");
    expect(res.status).toBe(404);
  });

  it("resolves a catalog spell to what a caster checks and its text", async () => {
    store(withSpells([{ ref: { name: "Shield", source: "PHB" }, prepared: true, origin: WIZARD }]));
    const [shield] = await spells();

    expect(shield).toEqual({
      resolved: true,
      name: "Shield",
      source: "PHB",
      prepared: true,
      origin: WIZARD,
      level: 1,
      school: "A",
      concentration: false,
      ritual: false,
      time: SHIELD.time,
      range: SHIELD.range,
      components: SHIELD.components,
      duration: SHIELD.duration,
      entries: SHIELD.entries,
    });
  });

  it("drops a casting fact that does not parse and keeps the rest", async () => {
    store(withSpells([{ ref: { name: "Detect Magic", source: "PHB" } }]));
    const [spell] = await spells();

    expect(spell).toMatchObject({ resolved: true, concentration: true, ritual: true });
    expect(spell).not.toHaveProperty("range");
    expect(spell).toHaveProperty("time", [{ number: 1, unit: "action" }]);
    expect(spell).toHaveProperty("entries", []);
  });

  it("resolves a homebrew spell by id and gives it no source", async () => {
    insertHomebrewSpell(opened.homebrewDb, "s", {
      name: "Glimmer",
      edition: "classic",
      level: 0,
      school: "V",
      duration: [{ type: "instant" }],
    });
    store(withSpells([{ ref: { homebrewId: "s" } }]));
    const [glimmer] = await spells();

    expect(glimmer).toMatchObject({ resolved: true, name: "Glimmer", level: 0, prepared: false });
    expect(glimmer).not.toHaveProperty("source");
  });

  it("lists a reference nothing answers, in order, with its stored name", async () => {
    store(
      withSpells([
        { ref: { name: "Lost Spell", source: "PHB" } },
        { ref: { homebrewId: "gone" } },
        { ref: { name: "Shield", source: "PHB" } },
      ]),
    );

    expect(await spells()).toEqual([
      { resolved: false, name: "Lost Spell", source: "PHB", prepared: false },
      { resolved: false, name: "Homebrew", prepared: false },
      expect.objectContaining({ resolved: true, name: "Shield" }),
    ]);
  });
});
