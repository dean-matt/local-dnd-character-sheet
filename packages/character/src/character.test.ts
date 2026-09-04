import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  abilityScoresSchema,
  type CharacterDefinition,
  type CharacterState,
  characterDefinitionSchema,
  characterStateSchema,
  derivedSchema,
  derivedValue,
  entryRefSchema,
  hitDicePoolSchema,
  resourceSchema,
  spellSlotSchema,
  totalLevel,
} from "./character.ts";

const definition: CharacterDefinition = {
  name: "Vex",
  edition: "one",
  classes: [
    {
      class: { name: "Warlock", source: "XPHB" },
      subclass: { name: "Fiend", source: "XPHB" },
      level: 3,
    },
    { class: { name: "Rogue", source: "XPHB" }, level: 2 },
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
      origin: { name: "Warlock", source: "XPHB" },
    },
  ],
};

const state: CharacterState = {
  hitPoints: { current: 21, temporary: 5 },
  hitDice: [
    { die: 8, total: 3, remaining: 1 },
    { die: 6, total: 2, remaining: 2 },
  ],
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
  it("sums a multiclass character", () => {
    expect(totalLevel(definition)).toBe(5);
  });

  it("requires at least one class", () => {
    expect(characterDefinitionSchema.safeParse({ ...definition, classes: [] }).success).toBe(false);
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
    const overLevelled = {
      ...definition,
      classes: [
        { class: { name: "Warlock", source: "XPHB" }, level: 20 },
        { class: { name: "Rogue", source: "XPHB" }, level: 20 },
      ],
    };
    expect(characterDefinitionSchema.safeParse(overLevelled).success).toBe(false);
  });

  it("rejects the same class listed twice", () => {
    const doubled = {
      ...definition,
      classes: [
        { class: { name: "Rogue", source: "XPHB" }, level: 3 },
        { class: { name: "Rogue", source: "XPHB" }, level: 2 },
      ],
    };
    expect(characterDefinitionSchema.safeParse(doubled).success).toBe(false);
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
