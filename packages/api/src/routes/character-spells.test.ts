import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CharacterSpells, HomebrewSpellInput } from "@dnd/catalog";
import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { insertCharacter } from "../db/queries/characters.ts";
import { type ItemFixtureRow, publishSpellLists } from "../db/queries/contentFixture.ts";
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
  item("Cloak of Shade", ["darkness|PHB"]),
  item("Ring of Warding", ["shield|PHB"]),
  item("Staff of Seeing", ["Detect Magic|PHB", "no such spell"], 1),
  {
    ...item("Mace of Judgment", undefined),
    json: JSON.stringify({
      name: "Mace of Judgment",
      source: "DMG",
      attachedSpellsByDeityAlignment: { "Lawful Good": ["shield|PHB"], NE: ["detect magic|PHB"] },
    }),
  },
  {
    ...item("Blade of Faith", undefined),
    json: JSON.stringify({
      name: "Blade of Faith",
      source: "DMG",
      attachedSpells: ["shield|PHB"],
      attachedSpellsByDeityAlignment: { LG: ["shield|PHB", "detect magic|PHB"] },
    }),
  },
];

const DEITIES = [
  { kind: "deity", name: "Moradin", source: "PHB", qualifier: "Dwarven", alignment: ["L", "G"] },
  {
    kind: "deity",
    name: "Bane",
    source: "PHB",
    qualifier: "Forgotten Realms",
    alignment: ["L", "E"],
  },
].map(({ alignment, ...key }) => ({
  ...key,
  edition: null,
  json: JSON.stringify({ name: key.name, source: key.source, alignment }),
}));

const MONK = { name: "Monk", source: "PHB" };
const MONK_ONE = { name: "Monk", source: "XPHB" };
const SHADOW = { name: "Way of Shadow", source: "PHB" };
const WARRIOR_OF_SHADOW = { name: "Warrior of Shadow", source: "XPHB" };
const SUN_SOUL = { name: "Way of the Sun Soul", source: "XGE" };
const DRUID = { name: "Druid", source: "PHB" };
const LAND = { name: "Circle of the Land", source: "PHB" };
const TIEFLING = { name: "Tiefling", source: "PHB" };
const GLOOM_TOUCHED = { name: "Gloom Touched", source: "PHB" };
const ASMODEUS = { name: "Asmodeus", source: "MTF" };
const HAUNTED_ONE = { name: "Haunted One", source: "CoS" };

/** A spell row carrying only what the sheet's facts read. */
const spellRow = (name: string, source: string, level: number) => ({
  name,
  source,
  edition: source === "XPHB" ? "one" : "classic",
  level,
  school: "I",
  concentration: 0 as const,
  ritual: 0 as const,
  json: JSON.stringify({ name, source, level, school: "I" }),
});

const SUBCLASSES = [
  {
    ...SHADOW,
    short_name: "Shadow",
    class: MONK,
    additionalSpells: [
      {
        known: { 3: ["minor illusion#c"] },
        innate: {
          3: { resource: { 2: ["darkness", "darkvision", "pass without trace", "silence"] } },
        },
        resourceName: "Ki",
        ability: "wis",
      },
    ],
  },
  {
    ...WARRIOR_OF_SHADOW,
    short_name: "Shadow",
    class: MONK_ONE,
    additionalSpells: [
      {
        known: { 3: ["minor illusion|xphb#c"] },
        innate: { 3: { resource: { 1: ["darkness|xphb"] } } },
        resourceName: "Focus Point",
        ability: "wis",
      },
    ],
  },
  {
    ...SUN_SOUL,
    short_name: "Sun Soul",
    class: MONK,
    additionalSpells: [
      { innate: { 6: { resource: { 2: ["burning hands"] } } }, resourceName: "Ki", ability: "wis" },
    ],
  },
  {
    ...LAND,
    short_name: "Land",
    class: DRUID,
    additionalSpells: [
      { name: "Arctic", prepared: { 3: ["darkvision"] } },
      { name: "Coast", innate: { 3: { resource: { 1: ["silence"] } } }, resourceName: "Tide" },
    ],
  },
];

/** The rows the build writes for `SUBCLASSES`' grants, each arriving at its key's level. */
const SUBCLASS_GRANTS = [
  [SHADOW, MONK, "Minor Illusion", "PHB", 3],
  [SHADOW, MONK, "Darkness", "PHB", 3],
  [SHADOW, MONK, "Darkvision", "PHB", 3],
  [SHADOW, MONK, "Pass without Trace", "PHB", 3],
  [SHADOW, MONK, "Silence", "PHB", 3],
  [WARRIOR_OF_SHADOW, MONK_ONE, "Minor Illusion", "XPHB", 3],
  [WARRIOR_OF_SHADOW, MONK_ONE, "Darkness", "XPHB", 3],
  [SUN_SOUL, MONK, "Burning Hands", "PHB", 6],
] as const;

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
    publishSpellLists(dataDir, {
      spells: [
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
        spellRow("Minor Illusion", "PHB", 0),
        spellRow("Darkness", "PHB", 2),
        spellRow("Darkvision", "PHB", 2),
        spellRow("Pass without Trace", "PHB", 2),
        spellRow("Silence", "PHB", 2),
        spellRow("Burning Hands", "PHB", 1),
        spellRow("Minor Illusion", "XPHB", 0),
        spellRow("Darkness", "XPHB", 2),
      ],
      items: ITEMS,
      lookups: DEITIES,
      subclasses: SUBCLASSES.map(({ short_name, class: cls, additionalSpells, ...ref }) => ({
        ...ref,
        short_name,
        class_name: cls.name,
        class_source: cls.source,
        edition: ref.source === "XPHB" ? "one" : "classic",
        json: JSON.stringify({ ...ref, additionalSpells }),
      })),
      spellGrants: [
        ...SUBCLASS_GRANTS.map(([subclass, cls, spell_name, spell_source, level]) => ({
          spell_name,
          spell_source,
          granted_by: "subclasses",
          name: subclass.name,
          source: subclass.source,
          parent_name: cls.name,
          parent_source: cls.source,
          chosen: 0 as const,
          level,
        })),
        ...(
          [
            ["Darkvision", 0],
            ["Silence", 1],
          ] as const
        ).map(([spell_name, block]) => ({
          spell_name,
          spell_source: "PHB",
          granted_by: "subclasses",
          name: LAND.name,
          source: LAND.source,
          parent_name: DRUID.name,
          parent_source: DRUID.source,
          chosen: 0 as const,
          level: 3,
          block,
        })),
        ...(
          [
            ["races", TIEFLING, 5, undefined],
            ["subraces", ASMODEUS, 0, TIEFLING],
            ["backgrounds", HAUNTED_ONE, 0, undefined],
            ["feats", GLOOM_TOUCHED, 0, undefined],
          ] as const
        ).map(([granted_by, row, level, parent]) => ({
          spell_name: "Darkness",
          spell_source: "PHB",
          granted_by,
          ...row,
          parent_name: parent?.name ?? "",
          parent_source: parent?.source ?? "",
          chosen: 0 as const,
          level,
        })),
      ],
    });
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

  describe("a spell a subclass grants", () => {
    const monk = (
      cls: { name: string; source: string },
      subclass: { name: string; source: string },
      level: number,
      spells: object[] = [],
      extra: object = {},
    ) => {
      const definition = withSpells(spells);
      store({
        ...definition,
        ...extra,
        levels: Array.from({ length: level }, (_, index) => ({
          class: cls,
          ...(index === 2 && { subclass }),
        })),
      } as CharacterDefinition);
    };
    const listed = async () =>
      (await spells()).map(({ name, source, fromSubclass, fromItem, cost, granted }) => ({
        name,
        source,
        fromSubclass,
        fromItem,
        cost,
        granted,
      }));

    it("lists a level 3 Way of Shadow Monk's spells, each with its Ki cost", async () => {
      monk(MONK, SHADOW, 3);
      const ki = { amount: 2, resource: "Ki" };
      expect(await listed()).toEqual([
        { name: "Darkness", source: "PHB", fromSubclass: SHADOW.name, cost: ki, granted: true },
        { name: "Darkvision", source: "PHB", fromSubclass: SHADOW.name, cost: ki, granted: true },
        { name: "Minor Illusion", source: "PHB", fromSubclass: SHADOW.name, granted: true },
        {
          name: "Pass without Trace",
          source: "PHB",
          fromSubclass: SHADOW.name,
          cost: ki,
          granted: true,
        },
        { name: "Silence", source: "PHB", fromSubclass: SHADOW.name, cost: ki, granted: true },
      ]);
    });

    it("lists a level 3 Warrior of Shadow Monk's spells, Darkness for a Focus Point", async () => {
      monk(MONK_ONE, WARRIOR_OF_SHADOW, 3);
      expect(await listed()).toEqual([
        {
          name: "Darkness",
          source: "XPHB",
          fromSubclass: WARRIOR_OF_SHADOW.name,
          cost: { amount: 1, resource: "Focus Point" },
          granted: true,
        },
        {
          name: "Minor Illusion",
          source: "XPHB",
          fromSubclass: WARRIOR_OF_SHADOW.name,
          granted: true,
        },
      ]);
    });

    it("leaves out a spell the subclass grants at a later class level", async () => {
      monk(MONK, SUN_SOUL, 5);
      expect(await spells()).toEqual([]);
    });

    it("lists it from that class level", async () => {
      monk(MONK, SUN_SOUL, 6);
      expect((await spells()).map(({ name }) => name)).toEqual(["Burning Hands"]);
    });

    describe("from alternative blocks", () => {
      const druid = (spellBlocks: object[]) =>
        store({
          ...withSpells([]),
          levels: Array.from({ length: 3 }, (_, index) => ({
            class: DRUID,
            ...(index === 2 && { subclass: LAND }),
          })),
          spellBlocks,
        } as CharacterDefinition);

      it("lists the chosen block's spells alone, with that block's cost", async () => {
        druid([{ grantor: { kind: "subclass", ref: LAND, class: DRUID }, block: 1 }]);
        expect(await listed()).toEqual([
          {
            name: "Silence",
            source: "PHB",
            fromSubclass: LAND.name,
            cost: { amount: 1, resource: "Tide" },
            granted: true,
          },
        ]);
      });

      it("lists none until a block is chosen", async () => {
        druid([]);
        expect(await spells()).toEqual([]);
      });
    });

    it("lists nothing below the level that picks the subclass", async () => {
      store({
        ...withSpells([]),
        levels: [{ class: MONK }, { class: MONK }],
      } as CharacterDefinition);
      expect(await spells()).toEqual([]);
    });

    it("costs a granted entry the definition holds, once, and leaves a pick uncosted", async () => {
      monk(MONK, SHADOW, 3, [
        { ref: { name: "Darkness", source: "PHB" }, prepared: true, granted: true },
        { ref: { name: "Silence", source: "PHB" }, origin: WIZARD },
      ]);
      const all = await spells();
      expect(all.filter(({ name }) => name === "Darkness")).toEqual([
        expect.objectContaining({ cost: { amount: 2, resource: "Ki" } }),
      ]);
      expect(all[0]).not.toHaveProperty("fromSubclass");
      const silence = all.filter(({ name }) => name === "Silence");
      expect(silence).toHaveLength(1);
      expect(silence[0]).not.toHaveProperty("cost");
    });

    describe("and another row gives too", () => {
      const DARKNESS = { ref: { name: "Darkness", source: "PHB" }, prepared: true, granted: true };
      const darkness = async () => (await listed()).filter(({ name }) => name === "Darkness");
      const free = { name: "Darkness", source: "PHB", granted: true };
      const costed = { ...free, fromSubclass: SHADOW.name, cost: { amount: 2, resource: "Ki" } };

      it("lists a Tiefling Shadow Monk's free Darkness beside Way of Shadow's", async () => {
        monk(MONK, SHADOW, 5, [DARKNESS], { race: TIEFLING });
        expect(await darkness()).toEqual([free, costed]);
      });

      it("leaves a feat's entry free", async () => {
        monk(MONK, SHADOW, 3, [DARKNESS], { feats: [GLOOM_TOUCHED] });
        expect(await darkness()).toEqual([free, costed]);
      });

      it("leaves a background's entry free", async () => {
        monk(MONK, SHADOW, 3, [DARKNESS], { background: HAUNTED_ONE });
        expect(await darkness()).toEqual([free, costed]);
      });

      it("leaves a subrace's entry free", async () => {
        monk(MONK, SHADOW, 3, [DARKNESS], { race: TIEFLING, subrace: ASMODEUS });
        expect(await darkness()).toEqual([free, costed]);
      });

      it("reads the race's grants under a homebrew subrace", async () => {
        monk(MONK, SHADOW, 5, [DARKNESS], { race: TIEFLING, subrace: { homebrewId: "h" } });
        expect(await darkness()).toEqual([free, costed]);
      });

      describe("and an equipped item attaches it", () => {
        const cloak = (equipped: boolean) => [
          {
            ref: { name: "Cloak of Shade", source: "DMG" },
            quantity: 1,
            carried: true,
            equipped,
            attuned: false,
          },
        ];
        const fromCloak = { ...free, fromItem: "Cloak of Shade" };

        it("lists the item's row beside the race's and the subclass's", async () => {
          monk(MONK, SHADOW, 5, [DARKNESS], { race: TIEFLING, inventory: cloak(true) });
          expect(await darkness()).toEqual([free, costed, fromCloak]);
        });

        it("lists it beside a feat's entry", async () => {
          monk(MONK, SHADOW, 3, [DARKNESS], { feats: [GLOOM_TOUCHED], inventory: cloak(true) });
          expect(await darkness()).toEqual([free, costed, fromCloak]);
        });

        it("lists it beside a background's entry", async () => {
          monk(MONK, SHADOW, 3, [DARKNESS], {
            background: HAUNTED_ONE,
            inventory: cloak(true),
          });
          expect(await darkness()).toEqual([free, costed, fromCloak]);
        });

        it("drops only the item's row once it is unequipped", async () => {
          monk(MONK, SHADOW, 5, [DARKNESS], { race: TIEFLING, inventory: cloak(false) });
          expect(await darkness()).toEqual([free, costed]);
        });
      });

      it("reads the entry as the subclass's before the race gives it", async () => {
        monk(MONK, SHADOW, 3, [DARKNESS], { race: TIEFLING });
        expect(await darkness()).toEqual([{ ...free, cost: costed.cost }]);
      });
    });

    describe("and an equipped item attaches it", () => {
      const cloak = {
        inventory: [
          {
            ref: { name: "Cloak of Shade", source: "DMG" },
            quantity: 1,
            carried: true,
            equipped: true,
            attuned: false,
          },
        ],
      };
      const darkness = async () =>
        (await spells())
          .filter(({ name }) => name === "Darkness")
          .map(({ fromItem, fromSubclass, cost }) => ({ fromItem, fromSubclass, cost }));
      const ki = { amount: 2, resource: "Ki" };

      it("lists the item's row beside the subclass's", async () => {
        monk(MONK, SHADOW, 3, [], cloak);
        expect(await darkness()).toEqual([
          { fromSubclass: SHADOW.name, cost: ki },
          { fromItem: "Cloak of Shade" },
        ]);
      });

      it("lists it beside the subclass's entry the definition holds", async () => {
        monk(
          MONK,
          SHADOW,
          3,
          [{ ref: { name: "Darkness", source: "PHB" }, prepared: true, granted: true }],
          cloak,
        );
        expect(await darkness()).toEqual([{ cost: ki }, { fromItem: "Cloak of Shade" }]);
      });
    });
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

    it("lists its own row beside a spell another row grants, with no subclass in play", async () => {
      store({
        ...withSpells(
          [{ ref: { name: "Darkness", source: "PHB" }, prepared: true, granted: true }],
          [held("Cloak of Shade", { equipped: true })],
        ),
        race: TIEFLING,
      });
      expect(
        (await spells())
          .filter(({ name }) => name === "Darkness")
          .map(({ granted, fromItem }) => ({ granted, fromItem })),
      ).toEqual([{ granted: true }, { granted: true, fromItem: "Cloak of Shade" }]);
    });

    describe("by the alignment of the character's deity", () => {
      const worshipping = (extra: object) =>
        store({
          ...withSpells([], [held("Mace of Judgment", { equipped: true })]),
          ...extra,
        } as CharacterDefinition);
      const MORADIN = { name: "Moradin", source: "PHB", pantheon: "Dwarven" };

      it("adds the spells whose alignment matches the deity row's", async () => {
        worshipping({ deity: MORADIN });
        expect((await spells()).map(({ name }) => name)).toEqual(["Shield"]);
      });

      it("reads the alignment from the deity row, not the character's own", async () => {
        worshipping({
          deity: { name: "Bane", source: "PHB", pantheon: "Forgotten Realms" },
          alignment: "Neutral Evil",
        });
        expect(await spells()).toEqual([]);
      });

      it("adds none from an item that is not equipped", async () => {
        store({
          ...withSpells([], [held("Mace of Judgment", { equipped: false })]),
          deity: MORADIN,
        } as CharacterDefinition);
        expect(await spells()).toEqual([]);
      });

      it("merges with the item's own spells, listing each once", async () => {
        store({
          ...withSpells([], [held("Blade of Faith", { equipped: true })]),
          deity: MORADIN,
        } as CharacterDefinition);
        expect((await spells()).map(({ name }) => name)).toEqual(["Shield", "Detect Magic"]);
      });

      it("adds none for a character with no deity", async () => {
        worshipping({});
        expect(await spells()).toEqual([]);
      });

      it("adds none for a deity no row answers", async () => {
        worshipping({ deity: { ...MORADIN, name: "Nobody" } });
        expect(await spells()).toEqual([]);
      });
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
