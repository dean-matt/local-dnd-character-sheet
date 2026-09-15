import { readFile } from "node:fs/promises";
import type { HitDie } from "@dnd/rules";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  abilityScoresSchema,
  type CharacterDefinition,
  type CharacterState,
  characterDefinitionSchema,
  characterDerivedSchema,
  characterStateSchema,
  derivedSchema,
  derivedValue,
  entryRefSchema,
  hitDicePoolSchema,
  hitPointMaximum,
  refKey,
  resourceSchema,
  spellSlotSchema,
  totalLevel,
} from "./index.ts";

const WARLOCK = { name: "Warlock", source: "XPHB" };
const ROGUE = { name: "Rogue", source: "XPHB" };

/** The `subclasses` row's own name; its features and tags spell `Fiend`. */
const FIEND_PATRON = { name: "Fiend Patron", source: "XPHB" };

/** Both d8 upstream, in both editions. */
const hitDice = new Map<string, HitDie>([
  [refKey(WARLOCK), 8],
  [refKey(ROGUE), 8],
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
  background: { name: "Charlatan", source: "XPHB" },
  abilityScores: { str: 8, dex: 16, con: 14, int: 10, wis: 12, cha: 17 },
  proficiencies: {
    savingThrows: ["wis", "cha"],
    skills: ["Deception", "Stealth"],
    armor: ["Light"],
    weapons: ["Simple"],
    tools: ["Thieves' Tools"],
    languages: ["Common", "Infernal"],
  },
  inventory: [
    { ref: { name: "Dagger", source: "XPHB" }, quantity: 2, equipped: true, attuned: false },
    { ref: { homebrewId: "hb_01" }, quantity: 1, equipped: false, attuned: true },
  ],
  spells: [
    {
      ref: { name: "Eldritch Blast", source: "XPHB" },
      prepared: true,
      origin: WARLOCK,
    },
  ],
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

describe("subrace", () => {
  /** Classic throughout, because upstream ships no subrace in the 2024 ruleset. */
  const elf = {
    ...definition,
    edition: "classic",
    levels: [{ class: { name: "Wizard", source: "PHB" } }],
    race: { name: "Elf", source: "PHB" },
    subrace: { name: "High", source: "PHB" },
    background: { name: "Sage", source: "PHB" },
    inventory: [],
    spells: [],
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
});

describe("derived fields", () => {
  const schema = derivedSchema(z.int());

  it("defaults to no override, matching an absent field_overrides row", () => {
    expect(schema.parse({ computed: 38 })).toEqual({ computed: 38, manual: null });
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
    expect(parsed.levels.map((level) => level.class.name)).toEqual([
      "Warlock",
      "Warlock",
      "Warlock",
      "Rogue",
      "Rogue",
    ]);
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
      [refKey(fighter), 10],
      [refKey(wizard), 6],
    ]);
    const fighterFirst = { ...definition, levels: [{ class: fighter }, { class: wizard }] };
    const wizardFirst = { ...definition, levels: [{ class: wizard }, { class: fighter }] };

    expect(hitPointMaximum(fighterFirst, dice)).toBe(10 + 4 + 2 * 2);
    expect(hitPointMaximum(wizardFirst, dice)).toBe(6 + 6 + 2 * 2);
  });

  it("rejects a class whose die the catalog did not supply", () => {
    expect(() => hitPointMaximum(definition, new Map([[refKey(ROGUE), 8]]))).toThrow(
      "No hit die for Warlock (XPHB)",
    );
  });

  it("has somewhere to live, overridable like any derived field", () => {
    const computed = hitPointMaximum(definition, hitDice);
    const derived = characterDerivedSchema.parse({ hitPointMaximum: { computed } });
    expect(derivedValue(derived.hitPointMaximum)).toBe(37);
    expect(derivedValue({ ...derived.hitPointMaximum, manual: 45 })).toBe(45);
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
    expect(characterDefinitionSchema.safeParse({ ...definition, alignment: "CN" }).success).toBe(
      false,
    );
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

  it.each(["PHB", "XPHB"])("rejects the %s condition row beside the level", (source) => {
    const both = { ...state, conditions: [{ name: "Exhaustion", source }] };
    expect(characterStateSchema.safeParse(both).success).toBe(false);
  });

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
