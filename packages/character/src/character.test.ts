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
    { class: WARLOCK, subclass: { name: "Fiend", source: "XPHB" } },
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
