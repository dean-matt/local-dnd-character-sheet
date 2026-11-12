import { describe, expect, it } from "vitest";
import {
  characterStateRecordSchema,
  characterStateSchema,
  defaultCharacterState,
  featureUsesKey,
  featureUsesSpent,
  hitDicePoolSchema,
  resourceSchema,
  spellSlotSchema,
  withFeatureUse,
} from "./index.ts";
import { state } from "./test/vex.ts";

describe("round trips", () => {
  it("preserves state through parse", () => {
    expect(characterStateSchema.parse(structuredClone(state))).toEqual(state);
  });

  it("survives a JSON round trip, as the database column does", () => {
    expect(characterStateSchema.parse(JSON.parse(JSON.stringify(state)))).toEqual(state);
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

describe("default state", () => {
  it("is unhurt, unspent and unconditioned", () => {
    expect(defaultCharacterState()).toEqual({
      hitPoints: { current: null, temporary: 0 },
      hitPointMaximumReduction: null,
      hitDice: [],
      spellSlots: [],
      pactSlots: null,
      conditions: [],
      customConditions: [],
      resources: [],
      classResources: [],
      featureUses: [],
      activeEffects: [],
      concentration: null,
      deathSaves: { successes: 0, failures: 0 },
      exhaustion: 0,
      inspiration: false,
    });
  });

  it("parses as a character's state", () => {
    expect(characterStateSchema.safeParse(defaultCharacterState()).success).toBe(true);
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

  it("rejects a class resource spent past its maximum, but not an unlimited one", () => {
    const pool = (maximum: number | null) => ({
      ...state,
      classResources: [
        { class: { name: "Barbarian", source: "PHB" }, key: "rages", maximum, expended: 7 },
      ],
    });
    expect(characterStateSchema.safeParse(pool(6)).success).toBe(false);
    expect(characterStateSchema.safeParse(pool(null)).success).toBe(true);
  });

  it("rejects a die size that is not a hit die", () => {
    expect(hitDicePoolSchema.safeParse({ die: 20, total: 1, remaining: 1 }).success).toBe(false);
  });
});

describe("invariants a duplicate row would break", () => {
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
});

describe("a state stored before class resources", () => {
  it("parses with none spent", () => {
    const { classResources: _, ...stored } = state;
    expect(characterStateSchema.parse(structuredClone(stored)).classResources).toEqual([]);
  });
});

describe("a key the schema does not name", () => {
  it("fails the state parse rather than letting the key vanish on the next save", () => {
    const newer = { ...state, readied: { name: "Bless", source: "XPHB" } };
    const result = characterStateSchema.safeParse(newer);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      code: "unrecognized_keys",
      keys: ["readied"],
    });
  });

  it("fails inside a nested object, not only at the top level", () => {
    const nested = { ...state, hitPoints: { ...state.hitPoints, maximum: 40 } };
    expect(characterStateSchema.safeParse(nested).success).toBe(false);
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

describe("active effects", () => {
  it("stores and reads back an effect other than Rage, and refuses one listed twice", () => {
    const blessed = { ...state, activeEffects: [{ name: "Rage" }, { name: "Bless" }] };
    expect(characterStateSchema.parse(structuredClone(blessed))).toEqual(blessed);
    expect(characterStateSchema.parse(JSON.parse(JSON.stringify(blessed))).activeEffects).toEqual([
      { name: "Rage" },
      { name: "Bless" },
    ]);
    const twice = { ...state, activeEffects: [{ name: "Bless" }, { name: "Bless" }] };
    expect(characterStateSchema.safeParse(twice).success).toBe(false);
  });

  it("parses a state stored before them with none active", () => {
    const { activeEffects: _, ...stored } = state;
    expect(characterStateSchema.parse(structuredClone(stored)).activeEffects).toEqual([]);
  });
});

describe("feature uses", () => {
  const lucky = featureUsesKey(["feat", "PHB"], "Lucky");
  const relentless = featureUsesKey(["trait", "catalog|Half-Orc|PHB"], "Relentless Endurance");

  it("replaces one feature's spent uses, or adds them, leaving the others", () => {
    const spent = withFeatureUse({ ...state, featureUses: [] }, lucky, 1);
    const both = withFeatureUse(spent, relentless, 1);
    expect(withFeatureUse(both, lucky, 2).featureUses).toEqual([
      { key: relentless, expended: 1 },
      { key: lucky, expended: 2 },
    ]);
  });

  it("reads spent uses capped at the count, and none where state holds none", () => {
    const spent = withFeatureUse({ ...state, featureUses: [] }, lucky, 3);
    expect(featureUsesSpent(spent, lucky, 5)).toBe(3);
    expect(featureUsesSpent(spent, lucky, 2)).toBe(2);
    expect(featureUsesSpent(spent, relentless, 1)).toBe(0);
  });

  it("refuses a feature listed twice", () => {
    const twice = {
      ...state,
      featureUses: [
        { key: lucky, expended: 1 },
        { key: lucky, expended: 2 },
      ],
    };
    expect(characterStateSchema.safeParse(twice).success).toBe(false);
  });

  it("parses a state stored before them with none spent", () => {
    const { featureUses: _, ...stored } = state;
    expect(characterStateSchema.parse(structuredClone(stored)).featureUses).toEqual([]);
  });
});

describe("custom conditions", () => {
  it("stores and reads back a name the catalog lacks", () => {
    const marked = { ...state, customConditions: ["Marked", "Cursed"] };
    expect(characterStateSchema.parse(structuredClone(marked))).toEqual(marked);
  });

  it("refuses a name listed twice or taking Exhaustion's, in any case", () => {
    for (const customConditions of [["Marked", "marked"], ["exhaustion"]]) {
      expect(characterStateSchema.safeParse({ ...state, customConditions }).success).toBe(false);
    }
  });

  it("parses a state stored before them with none", () => {
    const { customConditions: _, ...stored } = state;
    expect(characterStateSchema.parse(structuredClone(stored)).customConditions).toEqual([]);
  });
});

describe("a reduction to the hit point maximum", () => {
  it("stores an amount of 1 or more and whether a long rest clears it", () => {
    const reduced = { ...state, hitPointMaximumReduction: { amount: 5, clearsOnLongRest: false } };
    expect(characterStateSchema.parse(structuredClone(reduced))).toEqual(reduced);
    for (const amount of [0, 1.5]) {
      const invalid = { ...state, hitPointMaximumReduction: { amount, clearsOnLongRest: true } };
      expect(characterStateSchema.safeParse(invalid).success).toBe(false);
    }
  });

  it("parses a state stored before it as none", () => {
    const { hitPointMaximumReduction: _, ...stored } = state;
    expect(characterStateSchema.parse(structuredClone(stored)).hitPointMaximumReduction).toBeNull();
  });
});

describe("inspiration", () => {
  it("stores and reads back as held", () => {
    const held = { ...state, inspiration: true };
    expect(characterStateSchema.parse(structuredClone(held))).toEqual(held);
  });

  it("parses a state stored before it as none", () => {
    const { inspiration: _, ...stored } = state;
    expect(characterStateSchema.parse(structuredClone(stored)).inspiration).toBe(false);
  });
});

describe("concentration", () => {
  const hold = { spell: { name: "Hold Person", source: "PHB" }, level: 3 };

  it("holds one catalog or homebrew spell at a level from 0 to 9, or none", () => {
    for (const concentration of [
      null,
      hold,
      { spell: { homebrewId: "hb-1" }, level: 0 },
      { ...hold, level: 9 },
    ]) {
      const held = { ...state, concentration };
      expect(characterStateSchema.parse(JSON.parse(JSON.stringify(held)))).toEqual(held);
    }
  });

  it("refuses a level outside 0 to 9, a list of spells, or a spell with no reference", () => {
    for (const concentration of [
      { ...hold, level: 10 },
      { ...hold, level: -1 },
      { ...hold, level: 1.5 },
      [hold],
      { level: 1 },
    ]) {
      expect(characterStateSchema.safeParse({ ...state, concentration }).success).toBe(false);
    }
  });

  it("parses a state stored before it with none held", () => {
    const { concentration: _, ...stored } = state;
    expect(characterStateSchema.parse(structuredClone(stored)).concentration).toBeNull();
  });
});
