import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CharacterSpells, HomebrewSpellInput } from "@dnd/catalog";
import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { insertCharacter } from "../db/queries/characters.ts";
import { type ItemFixtureRow, publishSpells } from "../db/queries/contentFixture.ts";
import { insertHomebrewSpell, updateHomebrewSpell } from "../db/queries/homebrew.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { characterSpellsRoutes } from "./character-spells.ts";

const WIZARD = { name: "Wizard", source: "PHB" };
const SHIELD_REF = { name: "Shield", source: "PHB" };

type PickGrantor = NonNullable<CharacterDefinition["spells"][number]["pickedFor"]>;

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
  entriesHigherLevel: [
    { type: "entries", name: "At Higher Levels", entries: ["It lasts {@b longer}."] },
  ],
};

const withSpells = (spells: object[], inventory: object[] = []): CharacterDefinition =>
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
    inventory,
    spells,
  });

const item = (name: string, attachedSpells: unknown, requiresAttunement: 0 | 1 = 0) => ({
  name,
  source: "DMG",
  edition: "classic",
  kind: "item",
  type: null,
  rarity: "rare",
  requires_attunement: requiresAttunement,
  json: JSON.stringify({ name, source: "DMG", attachedSpells }),
});

const ITEMS: ItemFixtureRow[] = [
  item("Ring of Shielding", { will: ["shield"] }),
  item("Ring of Warding", ["shield|PHB"]),
  item("Staff of Seeing", ["Detect Magic|PHB", "no such spell"], 1),
];

describe("characterSpellsRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof characterSpellsRoutes>;

  const store = (definition: CharacterDefinition) =>
    insertCharacter(opened.charactersDb, { id: "1", definition });

  const spells = async (): Promise<CharacterSpells["spells"]> => {
    const res = await routes.request("/characters/1/spells");
    expect(res.status).toBe(200);
    return (await res.json()).spells;
  };

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "character-spells-"));
    publishSpells(
      dataDir,
      [
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
            damageInflict: "not a list",
            duration: [{ type: "timed", duration: { type: "minute", amount: 10 } }],
          }),
        },
        {
          name: "Fire Bolt",
          source: "PHB",
          edition: "classic",
          level: 0,
          school: "V",
          concentration: 0,
          ritual: 0,
          json: JSON.stringify({
            name: "Fire Bolt",
            source: "PHB",
            level: 0,
            school: "V",
            damageInflict: ["fire"],
            entries: [
              "A target takes {@damage 1d10} fire damage.",
              { type: "entries", entries: ["It rises to {@damage 2d10} at 5th level."] },
            ],
          }),
        },
      ],
      ITEMS,
    );
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    opened = openTestDatabases();
    routes = characterSpellsRoutes(opened.charactersDb, dataDir, opened.homebrewDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
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
      entries: [...SHIELD.entries, ...SHIELD.entriesHigherLevel],
    });
  });

  it("marks a spell something granted, and leaves a pick unmarked", async () => {
    store(
      withSpells([
        { ref: { name: "Shield", source: "PHB" }, granted: true },
        { ref: { name: "Shield", source: "PHB" }, origin: WIZARD },
      ]),
    );
    const [granted, picked] = await spells();

    expect(granted).toMatchObject({ name: "Shield", granted: true });
    expect(picked).not.toHaveProperty("granted");
  });

  it("carries the row a spell was picked for, of every kind the definition stores", async () => {
    const ref = { name: "Magic Initiate", source: "PHB" };
    const picks = {
      race: { kind: "race", ref },
      subrace: { kind: "subrace", ref, race: { name: "Elf", source: "PHB" } },
      background: { kind: "background", ref },
      feat: { kind: "feat", ref },
      optionalFeature: { kind: "optionalFeature", ref },
    } satisfies { [K in PickGrantor["kind"]]: Extract<PickGrantor, { kind: K }> };
    const grantors = Object.values(picks);
    store(withSpells(grantors.map((pickedFor) => ({ ref: SHIELD_REF, pickedFor }))));

    expect((await spells()).map((spell) => spell.pickedFor)).toEqual(grantors);
  });

  it("drops a casting fact that does not parse and keeps the rest", async () => {
    store(withSpells([{ ref: { name: "Detect Magic", source: "PHB" } }]));
    const [spell] = await spells();

    expect(spell).toMatchObject({ resolved: true, concentration: true, ritual: true });
    expect(spell).not.toHaveProperty("range");
    expect(spell).not.toHaveProperty("damageTypes");
    expect(spell).not.toHaveProperty("damageDice");
    expect(spell).toHaveProperty("time", [{ number: 1, unit: "action" }]);
    expect(spell).toHaveProperty("entries", []);
  });

  it("carries the first damage roll the text prints and every type the spell deals", async () => {
    store(withSpells([{ ref: { name: "Fire Bolt", source: "PHB" } }]));
    const [bolt] = await spells();

    expect(bolt).toMatchObject({ damageDice: "1d10", damageTypes: ["fire"] });
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

    expect(glimmer).toMatchObject({
      resolved: true,
      name: "Glimmer",
      homebrewId: "s",
      level: 0,
      prepared: false,
    });
    expect(glimmer).not.toHaveProperty("source");
  });

  it("keeps holding a homebrew spell through a rename, since it holds the id", async () => {
    const glimmer: HomebrewSpellInput = {
      name: "Glimmer",
      edition: "classic",
      level: 0,
      school: "V",
      duration: [{ type: "instant" }],
    };
    insertHomebrewSpell(opened.homebrewDb, "s", glimmer);
    store(withSpells([{ ref: { homebrewId: "s" } }]));

    updateHomebrewSpell(opened.homebrewDb, "s", { ...glimmer, name: "Gleam" });

    expect(await spells()).toEqual([
      expect.objectContaining({ resolved: true, name: "Gleam", homebrewId: "s" }),
    ]);
  });

  describe("a spell an item lets the character cast", () => {
    const held = (name: string, flags: { equipped: boolean; attuned?: boolean }) => ({
      ref: { name, source: "DMG" },
      quantity: 1,
      carried: true,
      attuned: false,
      ...flags,
    });

    it("lists it while the item is equipped, citing the item", async () => {
      store(withSpells([], [held("Ring of Shielding", { equipped: true })]));
      expect(await spells()).toEqual([
        expect.objectContaining({
          resolved: true,
          name: "Shield",
          source: "PHB",
          granted: true,
          prepared: true,
          fromItem: "Ring of Shielding",
        }),
      ]);
      expect((await spells())[0]).not.toHaveProperty("homebrewId");
    });

    it("drops it once the item is unequipped", async () => {
      store(withSpells([], [held("Ring of Shielding", { equipped: false })]));
      expect(await spells()).toEqual([]);
    });

    it("waits for attunement where the item requires it", async () => {
      store(withSpells([], [held("Staff of Seeing", { equipped: true })]));
      expect(await spells()).toEqual([]);
    });

    it("lists it once attuned, and leaves out a name no row answers", async () => {
      store(withSpells([], [held("Staff of Seeing", { equipped: true, attuned: true })]));
      expect((await spells()).map(({ name, fromItem }) => ({ name, fromItem }))).toEqual([
        { name: "Detect Magic", fromItem: "Staff of Seeing" },
      ]);
    });

    it("leaves a spell the definition already lists as that entry", async () => {
      store(
        withSpells(
          [{ ref: SHIELD_REF, origin: WIZARD }],
          [held("Ring of Shielding", { equipped: true })],
        ),
      );
      const listed = await spells();
      const [shield] = listed;
      expect(listed).toHaveLength(1);
      expect(shield).not.toHaveProperty("fromItem");
    });

    it("lists a spell once for the items that attach it, citing each", async () => {
      store(
        withSpells(
          [],
          [
            held("Ring of Shielding", { equipped: true }),
            held("Ring of Warding", { equipped: true }),
          ],
        ),
      );
      expect(await spells()).toEqual([
        expect.objectContaining({ name: "Shield", fromItem: "Ring of Shielding, Ring of Warding" }),
      ]);
    });

    it("lists it after the spells the definition holds", async () => {
      store(
        withSpells(
          [{ ref: SHIELD_REF, origin: WIZARD }],
          [held("Staff of Seeing", { equipped: true, attuned: true })],
        ),
      );
      expect((await spells()).map((spell) => spell.name)).toEqual(["Shield", "Detect Magic"]);
    });
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
      { resolved: false, name: "Homebrew", homebrewId: "gone", prepared: false },
      expect.objectContaining({ resolved: true, name: "Shield" }),
    ]);
  });
});
