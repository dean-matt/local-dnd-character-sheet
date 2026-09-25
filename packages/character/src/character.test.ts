import { readFile } from "node:fs/promises";
import {
  carryingCapacity,
  type Edition,
  encumbranceThresholds,
  exhaustionEffects,
  type HitDie,
  reducedSpeed,
} from "@dnd/rules";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  abilityScoresSchema,
  type CasterTable,
  type CharacterDefinition,
  type CharacterDerived,
  type CharacterState,
  carriedWeight,
  characterDefinitionSchema,
  characterDerivedSchema,
  characterPagesSchema,
  characterRecordSchema,
  characterStateRecordSchema,
  characterStateSchema,
  classLevels,
  classSummary,
  defaultCharacterState,
  degradePageBlock,
  deriveCharacter,
  derivedSchema,
  derivedValue,
  type EntryRef,
  encumberedSpeed,
  entryKey,
  entryRefSchema,
  hitDicePoolSchema,
  hitPointMaximum,
  houseRule,
  itemKey,
  PRESET_PAGES,
  passiveSkill,
  raceSummary,
  resourceSchema,
  spellSlotSchema,
  totalLevel,
} from "./index.ts";

const WARLOCK = { name: "Warlock", source: "XPHB" };
const ROGUE = { name: "Rogue", source: "XPHB" };

/** Upstream writes each of the eighteen skills twice, once per ruleset. */
const DECEPTION = { name: "Deception", source: "XPHB" };
const STEALTH = { name: "Stealth", source: "XPHB" };
const PERCEPTION = { name: "Perception", source: "XPHB" };

/** The `subclasses` row's own name; its features and tags spell `Fiend`. */
const FIEND_PATRON = { name: "Fiend Patron", source: "XPHB" };

/** The background grants the Origin feat it names: `Charlatan` (XPHB) grants `Skilled`. */
const CHARLATAN = { name: "Charlatan", source: "XPHB" };
const SKILLED = { name: "Skilled", source: "XPHB" };

/** What the Half-Elf row supplies: Medium, 30 feet, and no second movement mode. */
const raceTraits = {
  size: { computed: "medium" },
  speed: { computed: { walk: 30 } },
} as const;

/** Every ability at no proficiency, for a test that cares about something else entirely. */
const noSavingThrows = Object.fromEntries(
  (["str", "dex", "con", "int", "wis", "cha"] as const).map((ability) => [
    ability,
    { computed: 0 },
  ]),
);

/** The derived tree as the endpoint assembles it, with the traits under test swapped in. */
const derivedInput = (traits: object = {}) => ({
  abilityModifiers: noSavingThrows,
  hitPointMaximum: { computed: 37 },
  hitDice: [],
  proficiencyBonus: { computed: 2 },
  savingThrows: noSavingThrows,
  skills: [],
  armorClass: { computed: 10 },
  initiative: { computed: 0 },
  spellcasting: [],
  spellSlots: [],
  pactSlots: null,
  carryingCapacity: { computed: 120 },
  carriedWeight: 0,
  encumbrance: null,
  attunementSlots: { computed: 3 },
  ...raceTraits,
  ...traits,
});

/** Both d8 upstream, in both editions. */
const hitDice = new Map<string, HitDie>([
  [entryKey(WARLOCK), 8],
  [entryKey(ROGUE), 8],
]);

const definition: CharacterDefinition = {
  name: "Vex",
  edition: "one",
  levels: [
    { class: WARLOCK },
    { class: WARLOCK, rolled: 6 },
    { class: WARLOCK, subclass: FIEND_PATRON },
    { class: ROGUE, rolled: 3 },
    { class: ROGUE },
  ],
  race: { name: "Half-Elf", source: "XPHB" },
  background: CHARLATAN,
  abilityScores: { str: 8, dex: 16, con: 14, int: 10, wis: 12, cha: 17 },
  proficiencies: {
    savingThrows: ["wis", "cha"],
    skills: [
      { ref: DECEPTION, level: "proficient" },
      { ref: STEALTH, level: "expertise" },
    ],
    armor: ["Light"],
    weapons: ["Simple"],
    tools: [{ name: "Thieves' Tools", level: "expertise" }],
    languages: [
      { name: "Common", source: "XPHB" },
      { name: "Infernal", source: "XPHB" },
    ],
  },
  inventory: [
    {
      ref: { name: "Dagger", source: "XPHB" },
      quantity: 2,
      carried: true,
      equipped: true,
      attuned: false,
    },
    {
      ref: { homebrewId: "hb_01" },
      quantity: 1,
      carried: true,
      equipped: false,
      attuned: true,
    },
  ],
  spells: [
    {
      ref: { name: "Eldritch Blast", source: "XPHB" },
      prepared: true,
      origin: WARLOCK,
    },
  ],
  feats: [{ ref: SKILLED, grantedBy: { kind: "background", ref: CHARLATAN } }],
  optionalFeatures: [
    {
      ref: { name: "Agonizing Blast", source: "XPHB" },
      featureType: "EI",
      grantedBy: { kind: "class", ref: WARLOCK },
    },
  ],
  money: { copper: 7, silver: 0, electrum: 0, gold: 41, platinum: 2 },
  appearance: { age: "24", height: "5'6\"", eyes: "green" },
  houseRules: { encumbrance: true },
  notes: "Owes the Clasp a favor.",
};

const state: CharacterState = {
  hitPoints: { current: 21, temporary: 5 },
  hitDice: [{ die: 8, total: 5, remaining: 1 }],
  spellSlots: [],
  pactSlots: { level: 2, total: 2, expended: 1 },
  conditions: [{ name: "Prone", source: "XPHB" }],
  resources: [{ name: "Superiority Dice", current: 3, maximum: 4, resetsOn: "short" }],
  deathSaves: { successes: 0, failures: 0 },
  exhaustion: 1,
};

describe("round trips", () => {
  it("preserves a definition through parse", () => {
    expect(characterDefinitionSchema.parse(structuredClone(definition))).toEqual(definition);
  });

  it("preserves state through parse", () => {
    expect(characterStateSchema.parse(structuredClone(state))).toEqual(state);
  });

  it("survives a JSON round trip, as the database column does", () => {
    expect(characterStateSchema.parse(JSON.parse(JSON.stringify(state)))).toEqual(state);
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

  it("preserves a stored state record through parse", () => {
    const record = {
      characterId: "1",
      state,
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(characterStateRecordSchema.parse(structuredClone(record))).toEqual(record);
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

describe("default state", () => {
  it("is unhurt, unspent and unconditioned", () => {
    expect(defaultCharacterState()).toEqual({
      hitPoints: { current: 0, temporary: 0 },
      hitDice: [],
      spellSlots: [],
      pactSlots: null,
      conditions: [],
      resources: [],
      deathSaves: { successes: 0, failures: 0 },
      exhaustion: 0,
    });
  });

  it("parses as a character's state", () => {
    expect(characterStateSchema.safeParse(defaultCharacterState()).success).toBe(true);
  });
});

describe("references", () => {
  it("accepts a catalog pair and a homebrew id", () => {
    expect(entryRefSchema.safeParse({ name: "Rope", source: "XPHB" }).success).toBe(true);
    expect(entryRefSchema.safeParse({ homebrewId: "hb_01" }).success).toBe(true);
  });

  it("rejects a name without a source", () => {
    expect(entryRefSchema.safeParse({ name: "Rope" }).success).toBe(false);
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

  it("summarizes a race with no subrace by the race's own name", () => {
    expect(raceSummary(definition)).toBe("Half-Elf");
  });

  it("shows a homebrew race as Homebrew, with no catalog to resolve its name", () => {
    expect(raceSummary({ ...definition, race: { homebrewId: "hb_07" } })).toBe("Homebrew");
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
  /** Classic throughout, because upstream ships no subrace in the 2024 ruleset. */
  const elf: CharacterDefinition = {
    ...definition,
    edition: "classic",
    levels: [{ class: { name: "Wizard", source: "PHB" } }],
    race: { name: "Elf", source: "PHB" },
    subrace: { name: "High", source: "PHB" },
    background: { name: "Sage", source: "PHB" },
    inventory: [],
    spells: [],
    feats: [],
    optionalFeatures: [],
  };

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

  it("summarizes by the subrace's own name, not the race's", () => {
    expect(raceSummary(elf)).toBe("High");
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

  it("falls back to the printed rule for an option the table never named", () => {
    const parsed = characterDefinitionSchema.parse({ ...definition, houseRules: {} });
    expect(houseRule(parsed, "encumbrance")).toBe(false);
    expect(houseRule(parsed, "optionalClassFeatures")).toBe(false);
  });

  it("falls back to the printed rule for an option stored as undefined", () => {
    const parsed = characterDefinitionSchema.parse({
      ...definition,
      houseRules: { encumbrance: undefined },
    });
    expect(houseRule(parsed, "encumbrance")).toBe(false);
  });

  it("reads back the option the table set", () => {
    const parsed = characterDefinitionSchema.parse(structuredClone(definition));
    expect(houseRule(parsed, "encumbrance")).toBe(true);
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
      houseRules: _houseRules,
      ...older
    } = definition;
    const parsed = characterDefinitionSchema.parse(structuredClone(older));

    expect(parsed.feats).toEqual([]);
    expect(parsed.optionalFeatures).toEqual([]);
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

describe("derived fields", () => {
  const schema = derivedSchema(z.int());

  it("defaults to no override, matching an absent field_overrides row", () => {
    expect(schema.parse({ computed: 38 })).toEqual({ computed: 38, manual: null, terms: [] });
    expect(derivedValue({ computed: 38, manual: null })).toBe(38);
  });

  it("prefers the manual value without disturbing the computed one", () => {
    const field = schema.parse({ computed: 38, manual: 45 });
    expect(derivedValue(field)).toBe(45);
    expect(derivedValue({ ...field, computed: 52 })).toBe(45);
  });

  it("restores the computed value when the override is cleared", () => {
    expect(derivedValue({ computed: 38, manual: null })).toBe(38);
  });

  it("carries the terms behind the computed value, beside it rather than reconstructed later", () => {
    const terms = [{ label: "Base", value: 38, reference: { name: "Fighter", source: "PHB" } }];
    expect(schema.parse({ computed: 38, terms })).toEqual({ computed: 38, manual: null, terms });
  });

  it.each([
    ["a catalog row", { name: "Fighter", source: "PHB" }],
    ["another derived field", { derivedField: "hitPointMaximum" }],
    ["a house-rule option", { houseRuleOption: "encumbrance" }],
  ])("accepts a term referencing %s", (_label, reference) => {
    const terms = [{ label: "Base", value: 38, reference }];
    expect(schema.parse({ computed: 38, terms }).terms).toEqual(terms);
  });
});

describe("counters cannot exceed their pool", () => {
  it("rejects spending more slots than exist", () => {
    expect(spellSlotSchema.safeParse({ level: 1, total: 2, expended: 3 }).success).toBe(false);
  });

  it("rejects more hit dice remaining than total", () => {
    expect(hitDicePoolSchema.safeParse({ die: 8, total: 2, remaining: 3 }).success).toBe(false);
  });

  it("rejects a resource above its maximum", () => {
    expect(
      resourceSchema.safeParse({ name: "Ki", current: 6, maximum: 5, resetsOn: "short" }).success,
    ).toBe(false);
  });

  it("rejects a die size that is not a hit die", () => {
    expect(hitDicePoolSchema.safeParse({ die: 20, total: 1, remaining: 1 }).success).toBe(false);
  });
});

describe("class levels", () => {
  it("counts a multiclass character", () => {
    expect(totalLevel(definition)).toBe(5);
  });

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

  it("summarizes a multiclass character with a count per class, in the order each was first taken", () => {
    expect(classSummary(definition)).toBe("Warlock 3 / Rogue 2");
  });

  it("groups levels by class and names the subclass whichever level chose it", () => {
    expect(classLevels(definition)).toEqual([
      { class: WARLOCK, level: 3, subclass: FIEND_PATRON },
      { class: ROGUE, level: 2 },
    ]);
  });

  it("summarizes a single class with no count", () => {
    expect(classSummary({ ...definition, levels: [{ class: ROGUE }] })).toBe("Rogue");
  });

  it("shows a homebrew class as Homebrew, with no catalog to resolve its name", () => {
    const homebrew = { ...definition, levels: [{ class: { homebrewId: "hb_08" } }] };
    expect(classSummary(homebrew)).toBe("Homebrew");
  });
});

const withSkills = (skills: unknown) => ({
  ...definition,
  proficiencies: { ...definition.proficiencies, skills },
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

/** Vex is level 5, so the proficiency bonus is +3; Dexterity 16 and Charisma 17 give +3, Wisdom 12 gives +1. */
describe("passive scores", () => {
  it("doubles the bonus for expertise and adds it once for proficiency", () => {
    expect(passiveSkill(definition, STEALTH, "dex")).toBe(19);
    expect(passiveSkill(definition, DECEPTION, "cha")).toBe(16);
  });

  it("scores a skill the character is not proficient in rather than refusing it", () => {
    expect(passiveSkill(definition, PERCEPTION, "wis")).toBe(11);
  });

  it("rounds half proficiency down, as a bard's Jack of All Trades does", () => {
    const bard = withSkills([{ ref: STEALTH, level: "half" }]);

    expect(passiveSkill(characterDefinitionSchema.parse(bard), STEALTH, "dex")).toBe(14);
  });

  it("matches on the source too, so the other ruleset's row is a different skill", () => {
    expect(passiveSkill(definition, { name: "Stealth", source: "PHB" }, "dex")).toBe(13);
  });

  it("reads a character back out of the database column it was stored in", () => {
    const stored = characterDefinitionSchema.parse(JSON.parse(JSON.stringify(definition)));

    expect(passiveSkill(stored, STEALTH, "dex")).toBe(19);
  });
});

describe("hit point maximum", () => {
  it("takes the first die's highest face, then the roll or the average", () => {
    expect(hitPointMaximum(definition, hitDice)).toBe(8 + 6 + 5 + 3 + 5 + 2 * 5);
  });

  it("reads a character back out of the database column it was stored in", () => {
    const stored = characterDefinitionSchema.parse(JSON.parse(JSON.stringify(definition)));
    expect(hitPointMaximum(stored, hitDice)).toBe(8 + 6 + 5 + 3 + 5 + 2 * 5);
  });

  it("moves when a multiclass character reorders the levels it took", () => {
    const fighter = { name: "Fighter", source: "XPHB" };
    const wizard = { name: "Wizard", source: "XPHB" };
    const dice = new Map<string, HitDie>([
      [entryKey(fighter), 10],
      [entryKey(wizard), 6],
    ]);
    const fighterFirst = { ...definition, levels: [{ class: fighter }, { class: wizard }] };
    const wizardFirst = { ...definition, levels: [{ class: wizard }, { class: fighter }] };

    expect(hitPointMaximum(fighterFirst, dice)).toBe(10 + 4 + 2 * 2);
    expect(hitPointMaximum(wizardFirst, dice)).toBe(6 + 6 + 2 * 2);
  });

  it("rejects a class whose die the catalog did not supply", () => {
    expect(() => hitPointMaximum(definition, new Map([[entryKey(ROGUE), 8]]))).toThrow(
      "No hit die for catalog|Warlock|XPHB",
    );
  });

  it("takes the die for a homebrew class, keyed by its id rather than a name and source", () => {
    const homebrewLevels = { ...definition, levels: [{ class: { homebrewId: "hb_warden" } }] };
    const dice = new Map<string, HitDie>([[entryKey({ homebrewId: "hb_warden" }), 10]]);

    expect(hitPointMaximum(homebrewLevels, dice)).toBe(10 + 2);
  });

  it("has somewhere to live, overridable like any derived field", () => {
    const computed = hitPointMaximum(definition, hitDice);
    const derived = characterDerivedSchema.parse(derivedInput({ hitPointMaximum: { computed } }));
    expect(derivedValue(derived.hitPointMaximum)).toBe(37);
    expect(derivedValue({ ...derived.hitPointMaximum, manual: 45 })).toBe(45);
  });
});

describe("deriveCharacter", () => {
  const STUDDED_LEATHER = { name: "Studded Leather Armor", source: "XPHB" };
  const SHIELD = { name: "Shield", source: "XPHB" };

  /** The Warlock/Rogue fixture, with armor and a shield equipped. */
  const equipped: CharacterDefinition = {
    ...definition,
    inventory: [
      ...definition.inventory,
      { ref: STUDDED_LEATHER, quantity: 1, carried: true, equipped: true, attuned: false },
      { ref: SHIELD, quantity: 1, carried: true, equipped: true, attuned: false },
    ],
  };

  const catalog = {
    hitDice,
    spellcastingAbilities: new Map([[entryKey(WARLOCK), "cha" as const]]),
    casterTables: new Map([
      [
        entryKey(WARLOCK),
        {
          progression: "pact" as const,
          slots: [{ level: 2, total: 2 }],
          preparation: { printed: 4 },
        },
      ],
    ]),
    skills: [
      { ref: DECEPTION, ability: "cha" as const },
      { ref: STEALTH, ability: "dex" as const },
      { ref: PERCEPTION, ability: "wis" as const },
    ],
    size: "medium" as const,
    speed: { walk: 30 },
    armor: new Map([
      [entryKey(STUDDED_LEATHER), { category: "light" as const, armorClass: 12 }],
      [entryKey(SHIELD), { category: "shield" as const, armorClass: 2 }],
    ]),
    weights: new Map<string, number | null>([
      [entryKey({ name: "Dagger", source: "XPHB" }), 1],
      [entryKey({ homebrewId: "hb_01" }), null],
      [entryKey(STUDDED_LEATHER), 13],
      [entryKey(SHIELD), 6],
    ]),
  };

  const derived = deriveCharacter(equipped, catalog);

  it("parses as a derived block", () => {
    expect(characterDerivedSchema.safeParse(derived).success).toBe(true);
  });

  it("assembles hit points, size and speed the way the existing fields already do", () => {
    expect(derived.hitPointMaximum.computed).toBe(hitPointMaximum(equipped, hitDice));
    expect(derived.size.computed).toBe("medium");
    expect(derived.speed.computed).toEqual({ walk: 30 });
  });

  it("reads the proficiency bonus off total level", () => {
    expect(derived.proficiencyBonus.computed).toBe(3);
  });

  it("grants a saving throw only where the character is proficient", () => {
    expect(derived.savingThrows.wis).toEqual({
      computed: 4,
      manual: null,
      terms: [
        { label: "Wisdom", value: 1 },
        { label: "Proficiency", value: 3 },
      ],
    });
    expect(derived.savingThrows.cha.computed).toBe(6);
    expect(derived.savingThrows.str).toEqual({
      computed: -1,
      manual: null,
      terms: [{ label: "Strength", value: -1 }],
    });
  });

  it("scores every catalog skill, proficient or not, and attaches the skill it came from", () => {
    const deception = derived.skills.find((skill) => skill.ref.name === "Deception");
    const stealth = derived.skills.find((skill) => skill.ref.name === "Stealth");
    const perception = derived.skills.find((skill) => skill.ref.name === "Perception");

    expect(deception?.modifier).toEqual({
      computed: 6,
      manual: null,
      terms: [
        { label: "Charisma", value: 3, reference: DECEPTION },
        { label: "Proficiency", value: 3 },
      ],
    });
    expect(deception?.passive.computed).toBe(16);

    expect(stealth?.modifier.computed).toBe(9);
    expect(stealth?.passive.computed).toBe(19);

    expect(perception?.modifier).toEqual({
      computed: 1,
      manual: null,
      terms: [{ label: "Wisdom", value: 1, reference: PERCEPTION }],
    });
    expect(perception?.passive.computed).toBe(11);
  });

  it("sums worn armor, Dexterity and a shield, referencing the item each term came from", () => {
    expect(derived.armorClass).toEqual({
      computed: 17,
      manual: null,
      terms: [
        { label: "Armor", value: 12, reference: STUDDED_LEATHER },
        { label: "Dexterity", value: 3 },
        { label: "Shield", value: 2, reference: SHIELD },
      ],
    });
  });

  it("falls back to the unarmored base rather than throwing when nothing resolves", () => {
    const unarmored = deriveCharacter(definition, { ...catalog, armor: new Map() });
    expect(unarmored.armorClass.computed).toBe(13);
  });

  it("omits the reference when the equipped armor is homebrew", () => {
    const homebrewArmor = { homebrewId: "hb_leather" };
    const withHomebrew: CharacterDefinition = {
      ...definition,
      inventory: [
        ...definition.inventory,
        { ref: homebrewArmor, quantity: 1, carried: true, equipped: true, attuned: false },
      ],
    };
    const homebrewCatalog = {
      ...catalog,
      armor: new Map([[entryKey(homebrewArmor), { category: "light" as const, armorClass: 11 }]]),
      weights: new Map([...catalog.weights, [entryKey(homebrewArmor), 10]]),
    };

    const result = deriveCharacter(withHomebrew, homebrewCatalog);

    expect(result.armorClass.terms).toContainEqual({ label: "Armor", value: 11 });
  });

  it("sets every ability's modifier off its score", () => {
    expect(derived.abilityModifiers.str).toEqual({ computed: -1, manual: null, terms: [] });
    expect(derived.abilityModifiers.cha.computed).toBe(3);
  });

  it("pools hit dice by die size, so two d8 classes share one pool", () => {
    expect(derived.hitDice).toEqual([{ die: 8, total: { computed: 5, manual: null, terms: [] } }]);
  });

  it("keeps a pool per die size, in the order each was first taken", () => {
    const fighter = { name: "Fighter", source: "XPHB" };
    const multiclass = deriveCharacter(
      { ...equipped, levels: [...equipped.levels, { class: fighter }] },
      { ...catalog, hitDice: new Map([...hitDice, [entryKey(fighter), 10 as const]]) },
    );
    expect(multiclass.hitDice.map((pool) => [pool.die, pool.total.computed])).toEqual([
      [8, 5],
      [10, 1],
    ]);
  });

  it("rejects a class with no hit die rather than guessing one", () => {
    expect(() => deriveCharacter(equipped, { ...catalog, hitDice: new Map() })).toThrow(RangeError);
  });

  it("weighs the load, coins included, against what Strength 8 carries", () => {
    expect(derived.carryingCapacity).toEqual({ computed: 120, manual: null, terms: [] });
    expect(derived.carriedWeight).toBe(carriedWeight(equipped, catalog.weights));
    expect(derived.carriedWeight).toBe(2 + 13 + 6 + 1);
  });

  it("names the encumbrance tier where the table plays the variant, and none where it does not", () => {
    expect(derived.encumbrance).toBe("unencumbered");
    const laden = deriveCharacter(equipped, {
      ...catalog,
      weights: new Map([...catalog.weights, [entryKey(SHIELD), 90]]),
    });
    expect(laden.encumbrance).toBe("heavilyEncumbered");
    expect(deriveCharacter({ ...equipped, houseRules: {} }, catalog).encumbrance).toBeNull();
  });

  it("gives three attunement slots, and more to a high-level Artificer", () => {
    expect(derived.attunementSlots).toEqual({ computed: 3, manual: null, terms: [] });
    const artificer = { name: "Artificer", source: "TCE" };
    const tinkerer = deriveCharacter(
      { ...equipped, levels: Array.from({ length: 14 }, () => ({ class: artificer })) },
      { ...catalog, hitDice: new Map([[entryKey(artificer), 8 as const]]) },
    );
    expect(tinkerer.attunementSlots.computed).toBe(5);
  });

  it("reads initiative off Dexterity alone", () => {
    expect(derived.initiative).toEqual({ computed: 3, manual: null, terms: [] });
  });

  it("sets a save DC and attack bonus per caster class, and skips a class that does not cast", () => {
    expect(derived.spellcasting).toEqual([
      {
        class: WARLOCK,
        ability: "cha",
        saveDc: { computed: 14, manual: null, terms: [] },
        attackBonus: { computed: 6, manual: null, terms: [] },
        preparedSpells: { computed: 4, manual: null, terms: [] },
      },
    ]);
  });

  describe("spell slots", () => {
    const WIZARD = { name: "Wizard", source: "PHB" };
    const SORCERER = { name: "Sorcerer", source: "PHB" };
    const CLERIC = { name: "Cleric", source: "PHB" };
    const PALADIN = { name: "Paladin", source: "PHB" };
    const FIGHTER = { name: "Fighter", source: "PHB" };

    const caster = (...levels: { name: string; source: string }[]): CharacterDefinition => ({
      ...definition,
      levels: levels.map((ref) => ({ class: ref })),
    });
    const of = (count: number, ref: { name: string; source: string }) =>
      Array.from({ length: count }, () => ref);

    /** Each class's own table row at the level the test takes it to, as `content.db` holds it. */
    const tables = (entries: [EntryRef, CasterTable][]) => ({
      ...catalog,
      hitDice: new Map(entries.map(([ref]) => [entryKey(ref), 8 as const])),
      spellcastingAbilities: new Map(entries.map(([ref]) => [entryKey(ref), "int" as const])),
      casterTables: new Map(entries.map(([ref, table]) => [entryKey(ref), table])),
    });
    const totals = (block: CharacterDerived) =>
      block.spellSlots.map((slot) => [slot.level, slot.total.computed]);

    it("counts pact slots apart from the rest", () => {
      expect(derived.pactSlots).toEqual({
        level: 2,
        total: { computed: 2, manual: null, terms: [] },
      });
      expect(derived.spellSlots).toEqual([]);
    });

    it("reads a lone caster's own table, which the multiclass table would get wrong", () => {
      const paladin = tables([
        [
          PALADIN,
          {
            progression: "1/2",
            slots: [
              { level: 1, total: 4 },
              { level: 2, total: 2 },
            ],
          },
        ],
      ]);
      expect(totals(deriveCharacter(caster(...of(5, PALADIN)), paladin))).toEqual([
        [1, 4],
        [2, 2],
      ]);
    });

    it("reads the multiclass table at the combined caster level for two casters", () => {
      const block = deriveCharacter(
        caster(...of(3, WIZARD), ...of(2, CLERIC), ...of(3, FIGHTER)),
        tables([
          [WIZARD, { progression: "full", slots: [{ level: 1, total: 4 }] }],
          [CLERIC, { progression: "full", slots: [{ level: 1, total: 3 }] }],
          [FIGHTER, { progression: "1/3", slots: [{ level: 1, total: 2 }] }],
        ]),
      );
      expect(totals(block)).toEqual([
        [1, 4],
        [2, 3],
        [3, 3],
      ]);
    });

    it("leaves out a class that has a table but does not cast yet", () => {
      const catalogWith = tables([
        [WIZARD, { progression: "full", slots: [{ level: 1, total: 2 }] }],
        [PALADIN, { progression: "1/2", slots: [] }],
      ]);
      catalogWith.spellcastingAbilities.delete(entryKey(PALADIN));
      expect(totals(deriveCharacter(caster(WIZARD, PALADIN), catalogWith))).toEqual([[1, 2]]);
    });

    it("gives a character with no casting class no slots at all", () => {
      const block = deriveCharacter(caster(FIGHTER), {
        ...tables([]),
        hitDice: new Map([[entryKey(FIGHTER), 10 as const]]),
      });
      expect(block.spellSlots).toEqual([]);
      expect(block.pactSlots).toBeNull();
      expect(block.spellcasting).toEqual([]);
    });

    it("counts a classic prepared list from the class's own level and modifier", () => {
      const block = deriveCharacter(
        caster(...of(5, PALADIN), ...of(3, CLERIC)),
        tables([
          [PALADIN, { progression: "1/2", slots: [], preparation: { rule: "half-level" } }],
          [CLERIC, { progression: "full", slots: [], preparation: { rule: "level" } }],
        ]),
      );
      // int 10 is a +0 modifier, the ability `tables` gives every class.
      expect(block.spellcasting.map((entry) => entry.preparedSpells?.computed)).toEqual([2, 3]);
    });

    it("gives a class that knows its spells no prepared count", () => {
      const block = deriveCharacter(
        caster(SORCERER),
        tables([[SORCERER, { progression: "full", slots: [{ level: 1, total: 2 }] }]]),
      );
      expect(block.spellcasting[0]).not.toHaveProperty("preparedSpells");
    });
  });
});

describe("carried weight", () => {
  const ARROW = { name: "Arrow", source: "XPHB" };
  const BALL_BEARING = { name: "Ball Bearing", source: "PHB" };
  const CALTROP = { name: "Caltrop", source: "PHB" };
  const SLING_BULLET = { name: "Sling Bullet", source: "XPHB" };
  const DART = { name: "Dart", source: "XPHB" };
  const ROPE = { name: "Hempen Rope (50 feet)", source: "PHB" };
  const VIAL = { name: "Vial", source: "XPHB" };
  const CHEST = { name: "Chest", source: "PHB" };

  /** Upstream's own pounds, `Vial` (XPHB) among the rows that print none. */
  const catalog = new Map<string, number | null>([
    [entryKey(ARROW), 0.05],
    [entryKey(BALL_BEARING), 0.002],
    [entryKey(CALTROP), 0.1],
    [entryKey(SLING_BULLET), 0.075],
    [entryKey(DART), 0.25],
    [entryKey(ROPE), 10],
    [entryKey(VIAL), null],
    [entryKey(CHEST), 25],
    [entryKey({ homebrewId: "hb_01" }), 1],
  ]);

  const packing = (inventory: object[], money: object) =>
    characterDefinitionSchema.parse({ ...structuredClone(definition), inventory, money });

  it("totals what the character holds, homebrew and coins included", () => {
    const packed = packing(
      [{ ref: ROPE }, { ref: ARROW, quantity: 20 }, { ref: { homebrewId: "hb_01" }, quantity: 3 }],
      { gold: 50 },
    );
    expect(carriedWeight(packed, catalog)).toBe(10 + 1 + 3 + 1);
  });

  it("leaves out what is stored elsewhere, equipment and containers alike", () => {
    const packed = packing(
      [{ ref: ROPE }, { ref: CHEST, carried: false }, { ref: ARROW, quantity: 20, carried: false }],
      {},
    );
    expect(carriedWeight(packed, catalog)).toBe(10);
  });

  it("weighs an item whose row states no weight as nothing", () => {
    const packed = packing([{ ref: VIAL, quantity: 12 }, { ref: ROPE }], {});
    expect(carriedWeight(packed, catalog)).toBe(10);
  });

  it("rejects a reference neither store names, rather than weighing it zero", () => {
    const packed = packing([{ ref: { name: "Hat of Disguise", source: "XDMG" } }], {});
    expect(() => carriedWeight(packed, catalog)).toThrow(
      "No item row for catalog|Hat of Disguise|XDMG",
    );

    const homebrew = packing([{ ref: { homebrewId: "hb_99" } }], {});
    expect(() => carriedWeight(homebrew, catalog)).toThrow("No item row for homebrew|hb_99");
  });

  it("sums fractional weights exactly at the quantities a real pack reaches", () => {
    /** The printed bundles: a quiver, a bag of bearings, a bag of caltrops, a pouch, a sheaf. */
    const ammunition = [
      { ref: ARROW, quantity: 20 },
      { ref: BALL_BEARING, quantity: 1000 },
      { ref: CALTROP, quantity: 20 },
      { ref: SLING_BULLET, quantity: 20 },
      { ref: DART, quantity: 10 },
    ];
    const packed = packing(ammunition, { gold: 400, copper: 12 });
    const drifting = ammunition.reduce(
      (sum, entry) => sum + (catalog.get(entryKey(entry.ref)) ?? 0) * entry.quantity,
      0.02 * 412,
    );

    expect(carriedWeight(packed, catalog)).toBe(17.24);
    expect(drifting).not.toBe(17.24);
  });

  it("weighs a magic variant apart from the base item it expands", () => {
    const CHAIN_MAIL = { name: "Chain Mail", source: "PHB" };
    const BARDING = { name: "Barding", source: "PHB" };
    const weights = new Map([
      [itemKey({ ref: CHAIN_MAIL }), 55],
      [itemKey({ ref: CHAIN_MAIL, variant: BARDING }), 110],
    ]);
    const packed = packing([{ ref: CHAIN_MAIL }, { ref: CHAIN_MAIL, variant: BARDING }], {});
    expect(carriedWeight(packed, weights)).toBe(165);
  });

  it("counts every denomination the same, because every coin weighs the same", () => {
    const purse = { copper: 10, silver: 10, electrum: 10, gold: 10, platinum: 10 };
    expect(carriedWeight(packing([], purse), catalog)).toBe(1);
  });

  it("feeds the encumbrance thresholds a caller would otherwise invent a weight for", () => {
    const packed = packing([{ ref: ROPE, quantity: 5 }], {});
    const { encumbered } = encumbranceThresholds(packed.abilityScores.str, "medium");
    expect(carriedWeight(packed, catalog)).toBeGreaterThan(encumbered.atWeight);
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

describe("size and speed", () => {
  it("feeds the rules functions a caller would otherwise invent a size for", () => {
    const stored = characterDefinitionSchema.parse(structuredClone(definition));
    const size = derivedValue(characterDerivedSchema.parse(derivedInput()).size);

    expect(carryingCapacity(stored.abilityScores.str, size)).toBe(120);
    expect(encumbranceThresholds(stored.abilityScores.str, size)).toEqual({
      encumbered: { tier: "encumbered", atWeight: 40, speedReduction: 10, disadvantage: false },
      heavilyEncumbered: {
        tier: "heavilyEncumbered",
        atWeight: 80,
        speedReduction: 20,
        disadvantage: true,
      },
    });
  });

  it("recomputes both when the race changes, keeping a manual size", () => {
    const enlarged = characterDerivedSchema.parse(
      derivedInput({ size: { computed: "medium", manual: "large" } }),
    );
    const asHalfling = characterDerivedSchema.parse({
      ...enlarged,
      size: { ...enlarged.size, computed: "small" },
      speed: { computed: { walk: 25 } },
    });

    expect(asHalfling.size.computed).toBe("small");
    expect(derivedValue(asHalfling.size)).toBe("large");
    expect(derivedValue(asHalfling.speed)).toEqual({ walk: 25 });
  });

  it("carries the other movement modes a race grants", () => {
    const winged = characterDerivedSchema.parse(
      derivedInput({ speed: { computed: { walk: 30, fly: 30 } } }),
    );
    expect(derivedValue(winged.speed)).toEqual({ walk: 30, fly: 30 });
  });

  it("refuses a size the rules vocabulary does not name", () => {
    expect(
      characterDerivedSchema.safeParse(derivedInput({ size: { computed: "colossal" } })).success,
    ).toBe(false);
  });

  it("requires a walking speed, and refuses a mode the vocabulary does not name", () => {
    expect(
      characterDerivedSchema.safeParse(derivedInput({ speed: { computed: { fly: 30 } } })).success,
    ).toBe(false);
    expect(
      characterDerivedSchema.safeParse(
        derivedInput({ speed: { computed: { walk: 30, hover: 30 } } }),
      ).success,
    ).toBe(false);
  });
});

describe("encumbered speed", () => {
  /** A Strength of 8 at Medium: encumbered above 40 pounds, heavily above 80. */
  const ENCUMBERED_AT = 40;
  const HEAVILY_ENCUMBERED_AT = 80;

  const winged = { speed: { computed: { walk: 30, fly: 30, swim: 10 } } };

  const speeds = (
    weight: number,
    houseRules: object = { encumbrance: true },
    traits: object = winged,
  ) =>
    encumberedSpeed(
      characterDefinitionSchema.parse({ ...structuredClone(definition), houseRules }),
      characterDerivedSchema.parse(derivedInput(traits)),
      weight,
    );

  it("leaves the race's speeds alone where the table never opted in", () => {
    expect(speeds(HEAVILY_ENCUMBERED_AT * 10, {})).toEqual({
      speed: { walk: 30, fly: 30, swim: 10 },
      speedReduction: 0,
      disadvantage: false,
      reductionBreakdown: { total: 0, terms: [] },
    });
  });

  it("reduces every movement mode, not only walking", () => {
    expect(speeds(ENCUMBERED_AT + 1).speed).toEqual({ walk: 20, fly: 20, swim: 0 });
  });

  it("floors a mode at zero rather than moving the character backwards", () => {
    expect(speeds(HEAVILY_ENCUMBERED_AT + 1).speed).toEqual({ walk: 10, fly: 10, swim: 0 });
  });

  it.each([0, ENCUMBERED_AT])(
    "carries no penalty at %s pounds, the rule reading in excess of",
    (weight) => {
      expect(speeds(weight)).toEqual({
        speed: { walk: 30, fly: 30, swim: 10 },
        speedReduction: 0,
        disadvantage: false,
        reductionBreakdown: { total: 0, terms: [] },
      });
    },
  );

  it.each([ENCUMBERED_AT + 0.05, HEAVILY_ENCUMBERED_AT])(
    "loses 10 feet in excess of the lighter threshold, at %s pounds",
    (weight) => {
      expect(speeds(weight)).toEqual({
        speed: { walk: 20, fly: 20, swim: 0 },
        speedReduction: 10,
        disadvantage: false,
        reductionBreakdown: {
          total: 10,
          terms: [
            { label: "Encumbrance", value: 10, reference: { houseRuleOption: "encumbrance" } },
          ],
        },
      });
    },
  );

  it("surfaces the disadvantage the heavily encumbered state carries", () => {
    expect(speeds(HEAVILY_ENCUMBERED_AT + 0.05)).toEqual({
      speed: { walk: 10, fly: 10, swim: 0 },
      speedReduction: 20,
      disadvantage: true,
      reductionBreakdown: {
        total: 20,
        terms: [{ label: "Encumbrance", value: 20, reference: { houseRuleOption: "encumbrance" } }],
      },
    });
  });

  it("names the house rule behind a nonzero reduction rather than a bare number", () => {
    const laden = speeds(ENCUMBERED_AT + 1);
    expect(laden.reductionBreakdown.total).toBe(laden.speedReduction);
    expect(laden.reductionBreakdown.terms).toEqual([
      {
        label: "Encumbrance",
        value: laden.speedReduction,
        reference: { houseRuleOption: "encumbrance" },
      },
    ]);
  });

  it("reduces the speed a user typed over, not the one the race granted", () => {
    const typedOver = { speed: { computed: { walk: 30 }, manual: { walk: 40 } } };
    expect(speeds(HEAVILY_ENCUMBERED_AT + 1, { encumbrance: true }, typedOver).speed).toEqual({
      walk: 20,
    });
  });

  it("reads the size, which clamps a Tiny character's threshold to what it can carry", () => {
    const tiny = { size: { computed: "tiny" }, speed: { computed: { walk: 30 } } };
    const clamped = carryingCapacity(definition.abilityScores.str, "tiny");

    expect(clamped).toBe(60);
    expect(speeds(clamped, { encumbrance: true }, tiny).disadvantage).toBe(false);
    expect(speeds(clamped + 0.05, { encumbrance: true }, tiny)).toEqual({
      speed: { walk: 10 },
      speedReduction: 20,
      disadvantage: true,
      reductionBreakdown: {
        total: 20,
        terms: [{ label: "Encumbrance", value: 20, reference: { houseRuleOption: "encumbrance" } }],
      },
    });
  });

  /** What exhaustion costs a speed, in the terms `reducedSpeed` takes. */
  const exhaustionSpeedCost = (level: number, edition: Edition) => {
    const effects = exhaustionEffects(level, edition);
    return {
      reduction: effects.edition === "one" ? effects.speedReduction : 0,
      halved: effects.edition === "classic" && effects.speedHalved,
      zeroed: effects.edition === "classic" && effects.speedZero,
    };
  };

  it.each(["one", "classic"] as const)(
    "hands the reduction back unapplied, so %s exhaustion composes against the derived speed",
    (edition) => {
      const exhaustion = exhaustionSpeedCost(2, edition);
      const base = derivedValue(characterDerivedSchema.parse(derivedInput(winged)).speed).walk;
      const laden = speeds(ENCUMBERED_AT + 1);

      expect(laden.speedReduction).toBe(10);
      expect(laden.speed.walk).toBe(20);
      expect(
        reducedSpeed({
          ...exhaustion,
          base,
          reduction: laden.speedReduction + exhaustion.reduction,
        }),
      ).toBe(10);
    },
  );

  it.each([{ encumbrance: true }, {}])(
    "drops a mode written as undefined, which the parse keeps, under house rules %j",
    (houseRules) => {
      const absent = { speed: { computed: { walk: 30, fly: undefined } } };
      expect(Object.keys(speeds(ENCUMBERED_AT + 1, houseRules, absent).speed)).toEqual(["walk"]);
    },
  );

  it("stores nothing, so turning the option off restores the race's speeds", () => {
    const derived = characterDerivedSchema.parse(derivedInput(winged));
    const stored = characterDefinitionSchema.parse(structuredClone(definition));
    const laden = encumberedSpeed(stored, derived, HEAVILY_ENCUMBERED_AT + 1);

    expect(laden.speed).toEqual({ walk: 10, fly: 10, swim: 0 });
    expect(derivedValue(derived.speed)).toEqual({ walk: 30, fly: 30, swim: 10 });
    expect(speeds(HEAVILY_ENCUMBERED_AT + 1, {}).speed).toEqual({ walk: 30, fly: 30, swim: 10 });
  });
});

describe("ability scores", () => {
  it("requires all six abilities", () => {
    const { str: _str, ...missing } = definition.abilityScores;
    expect(abilityScoresSchema.safeParse(missing).success).toBe(false);
  });

  it("rejects a score outside 1-30", () => {
    expect(abilityScoresSchema.safeParse({ ...definition.abilityScores, str: 31 }).success).toBe(
      false,
    );
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

  it("rejects a roll no hit die can make", () => {
    const impossible = { ...definition, levels: [{ class: ROGUE, rolled: 13 }] };
    expect(characterDefinitionSchema.safeParse(impossible).success).toBe(false);
  });

  it("rejects two pools of the same hit die size", () => {
    const split = {
      ...state,
      hitDice: [
        { die: 8, total: 3, remaining: 3 },
        { die: 8, total: 3, remaining: 3 },
      ],
    };
    expect(characterStateSchema.safeParse(split).success).toBe(false);
  });

  it("rejects two rows for the same slot level", () => {
    const split = {
      ...state,
      spellSlots: [
        { level: 1, total: 2, expended: 0 },
        { level: 1, total: 2, expended: 1 },
      ],
    };
    expect(characterStateSchema.safeParse(split).success).toBe(false);
  });

  it("refuses a reference carrying both key styles rather than dropping one", () => {
    const ambiguous = { name: "Dagger", source: "XPHB", homebrewId: "hb_01" };
    expect(entryRefSchema.safeParse(ambiguous).success).toBe(false);
  });
});

describe("a key the schema does not name", () => {
  it("fails the state parse rather than letting the key vanish on the next save", () => {
    const newer = { ...state, concentration: { name: "Bless", source: "XPHB" } };
    const result = characterStateSchema.safeParse(newer);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      code: "unrecognized_keys",
      keys: ["concentration"],
    });
  });

  it("fails the definition parse", () => {
    expect(
      characterDefinitionSchema.safeParse({ ...definition, hitPointMaximum: 37 }).success,
    ).toBe(false);
  });

  it("fails inside a nested object, not only at the top level", () => {
    const nested = { ...state, hitPoints: { ...state.hitPoints, maximum: 40 } };
    expect(characterStateSchema.safeParse(nested).success).toBe(false);
  });

  it("fails a derived field, whose two states have no room for a third", () => {
    expect(derivedSchema(z.int()).safeParse({ computed: 38, cleared: true }).success).toBe(false);
  });

  /**
   * The parses above each name a schema. This one holds the schema added next: an open
   * object anywhere in the file reopens the hole, and a parse of a fixed shape misses it.
   *
   * Comments come out first, so that prose naming the forbidden call — as the module
   * doc above this one has every reason to — stays free to say it.
   */
  it("keeps every object in the file strict, including the one added next", async () => {
    const source = await readFile(new URL("./character.ts", import.meta.url), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

    expect(code).toContain("z.strictObject(");
    expect(code).not.toMatch(/\.(object|looseObject)\(/);
  });
});

describe("exhaustion", () => {
  it("is held as a level, with no reference in the condition list", () => {
    const parsed = characterStateSchema.parse(
      structuredClone({ ...state, conditions: [], exhaustion: 3 }),
    );

    expect(parsed.exhaustion).toBe(3);
    expect(parsed.conditions).toEqual([]);
  });

  /** The two catalog sources, and a homebrew one the name-alone match still has to catch. */
  it.each(["PHB", "XPHB", "hb_conditions"])(
    "rejects the %s condition row beside the level",
    (source) => {
      const both = { ...state, conditions: [{ name: "Exhaustion", source }] };
      expect(characterStateSchema.safeParse(both).success).toBe(false);
    },
  );

  it("rejects the row even where the level says zero", () => {
    const silent = {
      ...state,
      conditions: [{ name: "Exhaustion", source: "XPHB" }],
      exhaustion: 0,
    };
    expect(characterStateSchema.safeParse(silent).success).toBe(false);
  });

  it("accepts every other condition row", () => {
    const prone = { ...state, conditions: [{ name: "Prone", source: "XPHB" }] };
    expect(characterStateSchema.safeParse(prone).success).toBe(true);
  });
});

describe("pages", () => {
  const page = { slug: "grapple", title: "Grapple", blocks: [] };

  it("seeds presets that parse as a character's pages", () => {
    expect(characterPagesSchema.parse(PRESET_PAGES)).toEqual(PRESET_PAGES);
  });

  it.each([
    { kind: "tarot", deck: "Many Things" },
    { kind: "section", section: "grappling" },
    { kind: "section", section: "spells", filter: "concentration" },
    {},
  ])("refuses the block %j, so no stored page holds one", (block) => {
    expect(characterPagesSchema.safeParse([{ ...page, blocks: [block] }]).success).toBe(false);
  });

  it("defaults a page to shown", () => {
    expect(characterPagesSchema.parse([page])[0]?.hidden).toBe(false);
  });

  it("refuses a title of only whitespace, which would leave a link with no name", () => {
    expect(characterPagesSchema.safeParse([{ ...page, title: "  " }]).success).toBe(false);
  });

  it("refuses two pages under one slug", () => {
    expect(characterPagesSchema.safeParse([page, { ...page, title: "Again" }]).success).toBe(false);
  });

  it.each(["", "Grapple", "grapple rules", "grapple--rules", "-grapple", "grapple/rules"])(
    "refuses the slug %j, which a URL would not carry as written",
    (slug) => {
      expect(characterPagesSchema.safeParse([{ ...page, slug }]).success).toBe(false);
    },
  );

  it.each([
    { kind: "value", field: "armorClass" },
    { kind: "list", source: "spells", filter: { level: 3 } },
    { kind: "text", text: "{@spell fireball} at the ready." },
  ])("accepts the block %j", (block) => {
    expect(characterPagesSchema.safeParse([{ ...page, blocks: [block] }]).success).toBe(true);
  });

  it("refuses a value block naming a field nothing derives", () => {
    const block = { kind: "value", field: "speed" };
    expect(characterPagesSchema.safeParse([{ ...page, blocks: [block] }]).success).toBe(false);
  });

  it("defaults a list block's filter to empty", () => {
    const [parsed] = characterPagesSchema.parse([
      { ...page, blocks: [{ kind: "list", source: "inventory" }] },
    ]);
    expect(parsed?.blocks).toEqual([{ kind: "list", source: "inventory", filter: {} }]);
  });

  describe("degradePageBlock", () => {
    it("passes a known block through unchanged", () => {
      const block = { kind: "text", text: "notes" };
      expect(degradePageBlock(block)).toEqual(block);
    });

    it.each([
      { kind: "tarot", deck: "Many Things" },
      { kind: "section", section: "grappling" },
      {},
    ])("wraps the refused block %j as unknown, carrying the original data", (raw) => {
      expect(degradePageBlock(raw)).toEqual({ kind: "unknown", raw });
    });

    it("round-trips the wrapped block through a write", () => {
      const raw = { kind: "tarot", deck: "Many Things" };
      const degraded = degradePageBlock(raw);
      expect(characterPagesSchema.safeParse([{ ...page, blocks: [degraded] }]).success).toBe(true);
    });
  });
});
