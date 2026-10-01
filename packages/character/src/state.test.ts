import { describe, expect, it } from "vitest";
import {
  characterStateRecordSchema,
  characterStateSchema,
  defaultCharacterState,
  hitDicePoolSchema,
  resourceSchema,
  spellSlotSchema,
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
