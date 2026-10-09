import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  abilityScoresSchema,
  characterDefinitionSchema,
  characterRecordSchema,
  classSummary,
  entryKey,
  raceSummary,
} from "./index.ts";
import {
  CHARLATAN,
  DECEPTION,
  definition,
  elf,
  ROGUE,
  SKILLED,
  STEALTH,
  WARLOCK,
  withSkills,
} from "./test/vex.ts";

describe("round trips", () => {
  it("preserves a definition through parse", () => {
    expect(characterDefinitionSchema.parse(structuredClone(definition))).toEqual(definition);
  });

  it("preserves a stored record through parse", () => {
    const record = {
      id: "1",
      name: definition.name,
      edition: definition.edition,
      level: definition.levels.length,
      raceSummary: raceSummary(definition),
      classSummary: classSummary(definition),
      definition,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(characterRecordSchema.parse(structuredClone(record))).toEqual(record);
  });
});

describe("the example definition shipped with the repository", () => {
  it("parses against the schema", async () => {
    const raw = await readFile(
      new URL("../fixtures/example-character.json", import.meta.url),
      "utf8",
    );
    expect(() => characterDefinitionSchema.parse(JSON.parse(raw))).not.toThrow();
  });
});

describe("background", () => {
  it("references the catalog and homebrew alike, as inventory and spells do", () => {
    const homebrew = { ...definition, background: { homebrewId: "hb_06" } };
    expect(characterDefinitionSchema.parse(structuredClone(homebrew))).toEqual(homebrew);
  });

  it("records a homebrew background as a feat's grantor", () => {
    const granted = {
      ...definition,
      background: { homebrewId: "hb_06" },
      feats: [{ ref: SKILLED, grantedBy: { kind: "background", ref: { homebrewId: "hb_06" } } }],
    };
    expect(characterDefinitionSchema.parse(structuredClone(granted))).toEqual(granted);
  });
});

describe("race", () => {
  it("references the catalog and homebrew alike, as background does", () => {
    const homebrew = { ...definition, race: { homebrewId: "hb_07" } };
    expect(characterDefinitionSchema.parse(structuredClone(homebrew))).toEqual(homebrew);
  });

  it("records a homebrew race as a feat's grantor, the way Human (XPHB) does for a catalog one", () => {
    const granted = {
      ...definition,
      race: { homebrewId: "hb_07" },
      feats: [{ ref: SKILLED, grantedBy: { kind: "race", ref: { homebrewId: "hb_07" } } }],
    };
    expect(characterDefinitionSchema.parse(structuredClone(granted))).toEqual(granted);
  });
});

describe("class", () => {
  it("references the catalog and homebrew alike, as background does", () => {
    const homebrew = { ...definition, levels: [{ class: { homebrewId: "hb_08" } }] };
    expect(characterDefinitionSchema.parse(structuredClone(homebrew))).toEqual(homebrew);
  });

  it("records a homebrew class as a pick's grantor, the way a catalog class does", () => {
    const granted = {
      ...definition,
      levels: [{ class: { homebrewId: "hb_08" } }],
      feats: [{ ref: SKILLED, grantedBy: { kind: "class", ref: { homebrewId: "hb_08" } } }],
    };
    expect(characterDefinitionSchema.parse(structuredClone(granted))).toEqual(granted);
  });
});

describe("subrace", () => {
  it("names one beside the race that completes its key", () => {
    expect(characterDefinitionSchema.parse(structuredClone(elf))).toEqual(elf);
  });

  it("stays absent rather than being invented", () => {
    expect(characterDefinitionSchema.parse(structuredClone(definition))).not.toHaveProperty(
      "subrace",
    );
  });

  it("rejects the empty name a base variant's row is keyed on", () => {
    const base = { ...elf, subrace: { name: "", source: "PHB" } };
    expect(characterDefinitionSchema.safeParse(base).success).toBe(false);
  });
});

describe("money", () => {
  it("keeps the coins the character holds rather than one converted total", () => {
    const parsed = characterDefinitionSchema.parse(structuredClone(definition));
    expect(parsed.money).toEqual({ copper: 7, silver: 0, electrum: 0, gold: 41, platinum: 2 });
  });

  it("counts a denomination the character has none of as zero", () => {
    const gold = { ...definition, money: { gold: 41 } };
    expect(characterDefinitionSchema.parse(gold).money).toEqual({
      copper: 0,
      silver: 0,
      electrum: 0,
      gold: 41,
      platinum: 0,
    });
  });

  it("rejects a debt and a fraction of a coin", () => {
    expect(
      characterDefinitionSchema.safeParse({ ...definition, money: { gold: -1 } }).success,
    ).toBe(false);
    expect(
      characterDefinitionSchema.safeParse({ ...definition, money: { gold: 1.5 } }).success,
    ).toBe(false);
  });

  it("rejects a denomination no ruleset mints", () => {
    expect(
      characterDefinitionSchema.safeParse({ ...definition, money: { adamantine: 1 } }).success,
    ).toBe(false);
  });
});

describe("alignment", () => {
  /** Two closed lists would each refuse the other, and neither reaches a setting's own. */
  it.each(["Chaotic Neutral", "CN", "Unaligned", "Sigil-neutral"])(
    "accepts %s, which no enum would hold at once",
    (alignment) => {
      const parsed = characterDefinitionSchema.parse({ ...definition, alignment });
      expect(parsed.alignment).toBe(alignment);
    },
  );

  it("stays absent for a character whose ruleset never asked", () => {
    expect(characterDefinitionSchema.parse(structuredClone(definition))).not.toHaveProperty(
      "alignment",
    );
  });

  it("rejects the empty string, which says nothing an absent field does not", () => {
    expect(characterDefinitionSchema.safeParse({ ...definition, alignment: "" }).success).toBe(
      false,
    );
  });
});

describe("leveling", () => {
  it("reads a definition written before it existed as experience from zero", () => {
    const { leveling: _mode, experience: _total, ...older } = definition;
    const parsed = characterDefinitionSchema.parse(older);
    expect([parsed.leveling, parsed.experience]).toEqual(["xp", 0]);
  });

  it.each([-1, 1.5])("rejects an experience total of %s", (experience) => {
    expect(characterDefinitionSchema.safeParse({ ...definition, experience }).success).toBe(false);
  });

  it("rejects a mode no ruleset prints", () => {
    expect(
      characterDefinitionSchema.safeParse({ ...definition, leveling: "sessions" }).success,
    ).toBe(false);
  });
});

describe("appearance", () => {
  it("keeps each box the printed sheet has apart from the others", () => {
    const parsed = characterDefinitionSchema.parse(structuredClone(definition));
    expect(parsed.appearance).toEqual({ age: "24", height: "5'6\"", eyes: "green" });
  });

  it("leaves a box the player skipped absent rather than blank", () => {
    const parsed = characterDefinitionSchema.parse({
      ...definition,
      appearance: { hair: "black" },
    });
    expect(parsed.appearance).toEqual({ hair: "black" });
  });

  it("rejects a box the printed sheet does not have", () => {
    expect(
      characterDefinitionSchema.safeParse({ ...definition, appearance: { tattoos: "a raven" } })
        .success,
    ).toBe(false);
  });
});

describe("houseRules", () => {
  it("keeps an option the table set", () => {
    const parsed = characterDefinitionSchema.parse(structuredClone(definition));
    expect(parsed.houseRules).toEqual({ encumbrance: true });
  });

  it("stores nothing for an option the table never named", () => {
    const parsed = characterDefinitionSchema.parse({ ...definition, houseRules: {} });
    expect(parsed.houseRules).not.toHaveProperty("encumbrance");
  });

  it("rejects an option for a rule the sheet does not compute", () => {
    const flanking = { ...definition, houseRules: { flanking: true } };
    expect(characterDefinitionSchema.safeParse(flanking).success).toBe(false);
  });
});

describe("notes", () => {
  it("survives the JSON round trip the database column makes, newlines included", () => {
    const written = "Line one.\n\n  Line two, indented.\nLine three.\n";
    const stored = { ...definition, notes: written };
    const parsed = characterDefinitionSchema.parse(JSON.parse(JSON.stringify(stored)));

    expect(parsed.notes).toBe(written);
  });

  it("has no length ceiling", () => {
    const long = "word ".repeat(20_000);
    expect(characterDefinitionSchema.parse({ ...definition, notes: long }).notes).toBe(long);
  });
});

describe("departures", () => {
  const strength = { field: "abilityScores.str", note: "20 at level 1, past point buy's 15" };

  it("keeps the field and the note a departure names", () => {
    const parsed = characterDefinitionSchema.parse({ ...definition, departures: [strength] });
    expect(parsed.departures).toEqual([strength]);
  });

  it("rejects a departure with no note, which records nothing", () => {
    const silent = { ...definition, departures: [{ ...strength, note: "" }] };
    expect(characterDefinitionSchema.safeParse(silent).success).toBe(false);
  });
});

describe("deity", () => {
  /** Upstream writes this pair twice, one god in each pantheon. */
  const celtic = { name: "Oghma", source: "PHB", pantheon: "Celtic" };
  const faerunian = { name: "Oghma", source: "PHB", pantheon: "Forgotten Realms" };

  it("names the pantheon that tells two gods of one pair apart", () => {
    const first = characterDefinitionSchema.parse({ ...definition, deity: celtic });
    const second = characterDefinitionSchema.parse({ ...definition, deity: faerunian });

    expect(first.deity).toEqual(celtic);
    expect(second.deity).toEqual(faerunian);
    expect(first.deity).not.toEqual(second.deity);
  });

  it("rejects the pair alone, which names two rows", () => {
    const pair = { ...definition, deity: { name: "Oghma", source: "PHB" } };
    expect(characterDefinitionSchema.safeParse(pair).success).toBe(false);
  });

  /** It extends a reference rather than restating one, so it inherits that strictness. */
  it("stays strict, failing a key it does not name", () => {
    const domain = { ...definition, deity: { ...celtic, domains: ["Knowledge"] } };
    expect(characterDefinitionSchema.safeParse(domain).success).toBe(false);
  });

  it("stays absent for a character who worships nobody", () => {
    expect(characterDefinitionSchema.parse(structuredClone(definition))).not.toHaveProperty(
      "deity",
    );
  });
});

describe("a character stored before these fields existed", () => {
  it("parses unchanged, defaulting every one of them", () => {
    const {
      money: _money,
      appearance: _appearance,
      notes: _notes,
      feats: _feats,
      optionalFeatures: _optionalFeatures,
      featureChoices: _featureChoices,
      houseRules: _houseRules,
      departures: _departures,
      ...older
    } = definition;
    const parsed = characterDefinitionSchema.parse(structuredClone(older));

    expect(parsed.feats).toEqual([]);
    expect(parsed.optionalFeatures).toEqual([]);
    expect(parsed.featureChoices).toEqual([]);
    expect(parsed.money).toEqual({
      copper: 0,
      silver: 0,
      electrum: 0,
      gold: 0,
      platinum: 0,
    });
    expect(parsed.appearance).toEqual({});
    expect(parsed.houseRules).toEqual({});
    expect(parsed.notes).toBe("");
    expect(parsed.departures).toEqual([]);
    expect(parsed).toMatchObject(older);
  });
});

describe("feats", () => {
  const ASI = { name: "Ability Score Improvement", source: "XPHB" };
  const FIGHTER = { name: "Fighter", source: "XPHB" };
  const HUMAN = { name: "Human", source: "PHB" };

  const fighter = (feats: object[]) => ({
    ...definition,
    levels: Array.from({ length: 8 }, () => ({ class: FIGHTER })),
    feats,
  });

  it("references the catalog and homebrew alike, as inventory and spells do", () => {
    const taken = fighter([
      { ref: { name: "Lucky", source: "PHB" } },
      { ref: { homebrewId: "hb_02" }, grantedBy: { kind: "class", ref: FIGHTER }, level: 4 },
    ]);
    expect(characterDefinitionSchema.parse(structuredClone(taken))).toEqual(taken);
  });

  /** `Ability Score Improvement` (XPHB) is one reference under one grantor, taken twice. */
  it("tells two takings of a repeatable feat apart by the level each spent", () => {
    const twice = fighter([
      { ref: ASI, grantedBy: { kind: "class", ref: FIGHTER }, level: 4 },
      { ref: ASI, grantedBy: { kind: "class", ref: FIGHTER }, level: 8 },
    ]);
    expect(characterDefinitionSchema.parse(structuredClone(twice))).toEqual(twice);
  });

  it.each([
    ["a background, which grants the Origin feat it names", { kind: "background", ref: CHARLATAN }],
    ["a race", { kind: "race", ref: { name: "Human", source: "XPHB" } }],
    [
      "a subrace, beside the race its row is keyed on",
      { kind: "subrace", ref: { name: "Variant", source: "PHB" }, race: HUMAN },
    ],
    [
      "a subclass, beside the class its row is keyed on",
      { kind: "subclass", ref: { name: "Champion", source: "XPHB" }, class: FIGHTER },
    ],
  ])("records %s as the grantor of a feat", (_kind, grantedBy) => {
    const granted = { ...definition, feats: [{ ref: SKILLED, grantedBy }] };
    expect(characterDefinitionSchema.parse(structuredClone(granted))).toEqual(granted);
  });

  /** `Archery` (XPHB) is a feat where `Archery` (PHB) is an `FS:F` option. */
  it("names the class entitlement a 2024 fighting style spends, as an option pick does", () => {
    const archery = fighter([
      {
        ref: { name: "Archery", source: "XPHB" },
        grantedBy: { kind: "class", ref: FIGHTER },
        level: 1,
      },
    ]);
    expect(characterDefinitionSchema.parse(structuredClone(archery))).toEqual(archery);
  });

  it.each([
    ["a feat", { kind: "feat", ref: { name: "Fighting Initiate", source: "TCE" } }],
    ["an optional feature", { kind: "optionalFeature", ref: { name: "Riposte", source: "PHB" } }],
  ])("rejects %s as a grantor, which grants no feat in the catalog", (_kind, grantedBy) => {
    const granted = { ...definition, feats: [{ ref: SKILLED, grantedBy }] };
    expect(characterDefinitionSchema.safeParse(granted).success).toBe(false);
  });

  it("rejects a subrace grantor naming no race, since the pair alone collides", () => {
    const short = {
      ...definition,
      feats: [
        { ref: SKILLED, grantedBy: { kind: "subrace", ref: { name: "Variant", source: "PHB" } } },
      ],
    };
    expect(characterDefinitionSchema.safeParse(short).success).toBe(false);
  });

  it.each([0, 21])("rejects level %i, which no character spends an entitlement at", (level) => {
    const granted = {
      ...definition,
      feats: [{ ref: SKILLED, grantedBy: { kind: "class", ref: FIGHTER }, level }],
    };
    expect(characterDefinitionSchema.safeParse(granted).success).toBe(false);
  });

  it("reads a definition stored as a bare list of references, which said nothing", () => {
    const older = {
      ...definition,
      feats: [ASI, ASI, { homebrewId: "hb_02" }],
    };
    expect(characterDefinitionSchema.parse(structuredClone(older)).feats).toEqual([
      { ref: ASI },
      { ref: ASI },
      { ref: { homebrewId: "hb_02" } },
    ]);
  });
});

describe("optional features", () => {
  /** Offered under all four fighting-style codes, so the pick names the one it spends. */
  const dueling = { name: "Dueling", source: "PHB" };

  const pick = (featureType: string, grantedBy: object) => ({
    ref: dueling,
    featureType,
    grantedBy,
  });

  const FIGHTER = { name: "Fighter", source: "PHB" };
  /** The Fighter subclass that offers `FS:F`, at level 10; Battle Master offers `MV:B`. */
  const CHAMPION = { name: "Champion", source: "PHB" };

  it.each([
    ["a class", { kind: "class", ref: FIGHTER }],
    [
      "a subclass, beside the class its row is keyed on",
      { kind: "subclass", ref: CHAMPION, class: FIGHTER },
    ],
    ["a feat", { kind: "feat", ref: { name: "Fighting Initiate", source: "TCE" } }],
  ])("records %s as the grantor of a fighting style", (_kind, grantedBy) => {
    const picked = { ...definition, optionalFeatures: [pick("FS:F", grantedBy)] };
    expect(characterDefinitionSchema.parse(structuredClone(picked))).toEqual(picked);
  });

  /** A fighting style that grants a maneuver, so the pick it entitles is an `MV:B`. */
  it("records an optional feature as the grantor, as Superior Technique is", () => {
    const riposte = {
      ...definition,
      optionalFeatures: [
        {
          ref: { name: "Riposte", source: "PHB" },
          featureType: "MV:B",
          grantedBy: {
            kind: "optionalFeature",
            ref: { name: "Superior Technique", source: "TCE" },
          },
        },
      ],
    };
    expect(characterDefinitionSchema.parse(structuredClone(riposte))).toEqual(riposte);
  });

  it("rejects a grantor kind nothing in the catalog grants from", () => {
    const race = {
      ...definition,
      optionalFeatures: [pick("FS:F", { kind: "race", ref: dueling })],
    };
    expect(characterDefinitionSchema.safeParse(race).success).toBe(false);
  });

  it("rejects a subclass grantor naming no class, since 124 subclass rows need one", () => {
    const short = {
      ...definition,
      optionalFeatures: [pick("FS:F", { kind: "subclass", ref: CHAMPION })],
    };
    expect(characterDefinitionSchema.safeParse(short).success).toBe(false);
  });

  /** What a Fighter 1 / Bard 3 of that college holds: `Dueling` twice, once per type. */
  it("keeps one option picked under two types, which spends two entitlements", () => {
    const both = {
      ...definition,
      optionalFeatures: [
        pick("FS:F", { kind: "class", ref: FIGHTER }),
        pick("FS:B", {
          kind: "subclass",
          ref: { name: "College of Swords", source: "XGE" },
          class: { name: "Bard", source: "PHB" },
        }),
      ],
    };
    expect(characterDefinitionSchema.parse(structuredClone(both)).optionalFeatures).toHaveLength(2);
  });

  it("rejects the same option twice under one type", () => {
    const twice = {
      ...definition,
      optionalFeatures: [
        pick("FS:F", { kind: "class", ref: FIGHTER }),
        pick("FS:F", { kind: "feat", ref: { name: "Fighting Initiate", source: "TCE" } }),
      ],
    };
    expect(characterDefinitionSchema.safeParse(twice).success).toBe(false);
  });

  it("accepts a homebrew option, and tells its id from a catalog pair", () => {
    const homebrew = {
      ...definition,
      optionalFeatures: [
        {
          ref: { homebrewId: "hb_03" },
          featureType: "EI",
          grantedBy: { kind: "class", ref: WARLOCK },
        },
        pick("EI", { kind: "class", ref: WARLOCK }),
      ],
    };
    expect(characterDefinitionSchema.parse(structuredClone(homebrew))).toEqual(homebrew);
  });

  it("rejects a pick with no feature type, which names no entitlement", () => {
    const untyped = {
      ...definition,
      optionalFeatures: [pick("", { kind: "class", ref: FIGHTER })],
    };
    expect(characterDefinitionSchema.safeParse(untyped).success).toBe(false);
  });
});

describe("class levels", () => {
  it("requires at least one level", () => {
    expect(characterDefinitionSchema.safeParse({ ...definition, levels: [] }).success).toBe(false);
  });

  it("keeps the order the levels were taken", () => {
    const parsed = characterDefinitionSchema.parse(structuredClone(definition));
    expect(parsed.levels.map((level) => entryKey(level.class))).toEqual([
      entryKey(WARLOCK),
      entryKey(WARLOCK),
      entryKey(WARLOCK),
      entryKey(ROGUE),
      entryKey(ROGUE),
    ]);
  });
});

describe("proficiencies", () => {
  it("names the row a {@skill} or {@language} token resolves against", () => {
    const parsed = characterDefinitionSchema.parse(structuredClone(definition));

    expect(parsed.proficiencies.skills.map((skill) => skill.ref)).toEqual([DECEPTION, STEALTH]);
    expect(parsed.proficiencies.languages).toEqual([
      { name: "Common", source: "XPHB" },
      { name: "Infernal", source: "XPHB" },
    ]);
  });

  it("rejects the bare name, which upstream writes over several rows", () => {
    expect(characterDefinitionSchema.safeParse(withSkills(["Stealth"])).success).toBe(false);

    const languages = {
      ...definition,
      proficiencies: { ...definition.proficiencies, languages: ["Common"] },
    };
    expect(characterDefinitionSchema.safeParse(languages).success).toBe(false);
  });

  it("keeps armor and weapons as the categories an item's type names", () => {
    const parsed = characterDefinitionSchema.parse(structuredClone(definition));

    expect(parsed.proficiencies.armor).toEqual(["Light"]);
    expect(parsed.proficiencies.weapons).toEqual(["Simple"]);
  });

  it("records a tool's level, which a rogue's expertise in Thieves' Tools needs", () => {
    const parsed = characterDefinitionSchema.parse(structuredClone(definition));

    expect(parsed.proficiencies.tools).toEqual([{ name: "Thieves' Tools", level: "expertise" }]);
  });

  it.each(["none", "half", "proficient", "expertise"])("accepts a level of %s", (level) => {
    const parsed = characterDefinitionSchema.parse(withSkills([{ ref: STEALTH, level }]));

    expect(parsed.proficiencies.skills).toEqual([{ ref: STEALTH, level }]);
  });

  it("rejects a level the vocabulary does not name", () => {
    expect(
      characterDefinitionSchema.safeParse(withSkills([{ ref: STEALTH, level: "double" }])).success,
    ).toBe(false);
  });

  it("rejects the flag the level replaced, rather than storing both", () => {
    expect(
      characterDefinitionSchema.safeParse(
        withSkills([{ ref: STEALTH, level: "proficient", expertise: true }]),
      ).success,
    ).toBe(false);
  });

  it("rejects the same skill, language or tool listed twice", () => {
    const skills = [
      { ref: STEALTH, level: "proficient" },
      { ref: STEALTH, level: "expertise" },
    ];
    expect(characterDefinitionSchema.safeParse(withSkills(skills)).success).toBe(false);

    const languages = {
      ...definition,
      proficiencies: {
        ...definition.proficiencies,
        languages: [
          { name: "Common", source: "XPHB" },
          { name: "Common", source: "XPHB" },
        ],
      },
    };
    expect(characterDefinitionSchema.safeParse(languages).success).toBe(false);

    const tools = {
      ...definition,
      proficiencies: {
        ...definition.proficiencies,
        tools: [
          { name: "Thieves' Tools", level: "proficient" },
          { name: "Thieves' Tools", level: "expertise" },
        ],
      },
    };
    expect(characterDefinitionSchema.safeParse(tools).success).toBe(false);
  });

  it("holds one language under each source that reprints it", () => {
    const both = {
      ...definition,
      proficiencies: {
        ...definition.proficiencies,
        languages: [
          { name: "Common", source: "PHB" },
          { name: "Common", source: "XPHB" },
        ],
      },
    };
    expect(characterDefinitionSchema.safeParse(both).success).toBe(true);
  });
});

describe("inventory", () => {
  it("records a thing left behind apart from one merely unequipped", () => {
    const stored = characterDefinitionSchema.parse({
      ...structuredClone(definition),
      inventory: [
        { ref: { name: "Hempen Rope (50 feet)", source: "PHB" }, carried: true },
        { ref: { name: "Chest", source: "PHB" }, carried: false },
      ],
    });
    expect(stored.inventory.map((entry) => entry.carried)).toEqual([true, false]);
    expect(stored.inventory.map((entry) => entry.equipped)).toEqual([false, false]);
  });

  it("carries an entry stored before the field existed", () => {
    const older = {
      ...structuredClone(definition),
      inventory: [{ ref: { name: "Dagger", source: "XPHB" }, quantity: 2, equipped: true }],
    };
    expect(characterDefinitionSchema.parse(older).inventory[0]).toEqual({
      ref: { name: "Dagger", source: "XPHB" },
      quantity: 2,
      carried: true,
      equipped: true,
      attuned: false,
    });
  });

  it("rejects an item wielded from a chest at the inn", () => {
    const wielded = {
      ...structuredClone(definition),
      inventory: [{ ref: { name: "Dagger", source: "XPHB" }, carried: false, equipped: true }],
    };
    expect(characterDefinitionSchema.safeParse(wielded).success).toBe(false);
  });

  it("stores a versatile weapon's grip, and refuses a grip outside the two", () => {
    const held = (grip: string) => ({
      ...structuredClone(definition),
      inventory: [{ ref: { name: "Longsword", source: "XPHB" }, grip }],
    });
    expect(characterDefinitionSchema.parse(held("two-handed")).inventory[0]?.grip).toBe(
      "two-handed",
    );
    expect(characterDefinitionSchema.safeParse(held("both")).success).toBe(false);
  });

  it("names a magic variant beside the base item it expands, rather than storing it expanded", () => {
    const enchanted = {
      ...structuredClone(definition),
      inventory: [
        {
          ref: { name: "Longsword", source: "XPHB" },
          variant: { name: "+1 Weapon", source: "XDMG" },
        },
      ],
    };
    const stored = characterDefinitionSchema.parse(enchanted);
    expect(stored.inventory[0]?.variant).toEqual({ name: "+1 Weapon", source: "XDMG" });
  });

  it("rejects a variant paired with a homebrew ref, which carries no field for inherits to read", () => {
    const homebrewVariant = {
      ...structuredClone(definition),
      inventory: [{ ref: { homebrewId: "hb_01" }, variant: { name: "+1 Weapon", source: "XDMG" } }],
    };
    expect(characterDefinitionSchema.safeParse(homebrewVariant).success).toBe(false);
  });
});

describe("ability scores", () => {
  it("requires all six abilities", () => {
    const { str: _str, ...missing } = definition.abilityScores;
    expect(abilityScoresSchema.safeParse(missing).success).toBe(false);
  });

  it("rejects a score outside 1-30 in words a sheet can show", () => {
    const result = abilityScoresSchema.safeParse({ ...definition.abilityScores, str: 31 });
    expect(result.error?.issues[0]?.message).toBe("A score is a whole number from 1 to 30.");
  });

  it("keeps an increase beside the score, defaulting to none, and refuses one of 0", () => {
    const { abilityIncreases: _, ...without } = definition;
    expect(characterDefinitionSchema.parse(without).abilityIncreases).toEqual([]);
    const increase = { ability: "dex", amount: 2, grantedBy: "race" };
    expect(
      characterDefinitionSchema.parse({ ...definition, abilityIncreases: [increase] })
        .abilityIncreases,
    ).toEqual([increase]);
    expect(
      characterDefinitionSchema.safeParse({
        ...definition,
        abilityIncreases: [{ ...increase, amount: 0 }],
      }).success,
    ).toBe(false);
  });

  it("names a missing name in words a sheet can show", () => {
    const result = characterDefinitionSchema.safeParse({ ...definition, name: "" });
    expect(result.error?.issues[0]?.message).toBe("A character needs a name.");
  });
});

describe("invariants a duplicate row would break", () => {
  it("rejects a total level above 20", () => {
    const overLevelled = { ...definition, levels: Array(21).fill({ class: ROGUE }) };
    expect(characterDefinitionSchema.safeParse(overLevelled).success).toBe(false);
  });

  it("rejects a class naming a subclass on two levels", () => {
    const twice = {
      ...definition,
      levels: [
        { class: ROGUE, subclass: { name: "Thief", source: "XPHB" } },
        { class: ROGUE, subclass: { name: "Assassin", source: "XPHB" } },
      ],
    };
    expect(characterDefinitionSchema.safeParse(twice).success).toBe(false);
  });

  it("keeps a gain no hit die can make, and rejects a fractional one", () => {
    const typed = (rolled: number) => ({ ...definition, levels: [{ class: ROGUE, rolled }] });
    expect(characterDefinitionSchema.safeParse(typed(13)).success).toBe(true);
    expect(characterDefinitionSchema.safeParse(typed(0)).success).toBe(true);
    expect(characterDefinitionSchema.safeParse(typed(1.5)).success).toBe(false);
  });

  it("bounds a gain at 999 either way, so a summed maximum stays a safe integer", () => {
    const typed = (rolled: number) => ({ ...definition, levels: [{ class: ROGUE, rolled }] });
    expect(characterDefinitionSchema.safeParse(typed(999)).success).toBe(true);
    expect(characterDefinitionSchema.safeParse(typed(-999)).success).toBe(true);
    expect(characterDefinitionSchema.safeParse(typed(1000)).success).toBe(false);
    expect(characterDefinitionSchema.safeParse(typed(-1000)).success).toBe(false);
  });
});

describe("featureChoices", () => {
  const totemSpirit = {
    name: "Totem Spirit",
    source: "PHB",
    className: "Barbarian",
    classSource: "PHB",
    subclass: { shortName: "Totem Warrior", source: "PHB" },
    level: 3,
  };
  const choosing = (...featureChoices: unknown[]) => ({ ...definition, featureChoices });

  it("keeps the option taken beside the feature that offers it", () => {
    const choice = { feature: totemSpirit, options: [{ name: "Elk", source: "SCAG" }] };
    expect(characterDefinitionSchema.parse(choosing(choice)).featureChoices).toEqual([choice]);
  });

  it("tells one feature's choice from another's by the whole key, level included", () => {
    const at = (level: number) => ({
      feature: { ...totemSpirit, level },
      options: [{ name: "Bear", source: "PHB" }],
    });
    expect(characterDefinitionSchema.safeParse(choosing(at(3), at(6))).success).toBe(true);
    expect(characterDefinitionSchema.safeParse(choosing(at(3), at(3))).success).toBe(false);
  });

  it("rejects a choice taking nothing, or taking one option twice", () => {
    const bear = { name: "Bear", source: "PHB" };
    expect(
      characterDefinitionSchema.safeParse(choosing({ feature: totemSpirit, options: [] })).success,
    ).toBe(false);
    expect(
      characterDefinitionSchema.safeParse(choosing({ feature: totemSpirit, options: [bear, bear] }))
        .success,
    ).toBe(false);
  });
});

describe("a key the schema does not name", () => {
  it("fails the definition parse", () => {
    expect(
      characterDefinitionSchema.safeParse({ ...definition, hitPointMaximum: 37 }).success,
    ).toBe(false);
  });
});
