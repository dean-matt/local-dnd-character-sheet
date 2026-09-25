import { describe, expect, it } from "vitest";
import {
  classGrantsSchema,
  classRecordSchema,
  homebrewClassInputSchema,
  homebrewClassRecordSchema,
  preparedSpellCountSchema,
  spellcastingAbilitySchema,
  subclassRecordSchema,
} from "./index.ts";

describe("classRecordSchema", () => {
  it("accepts a catalog row", () => {
    const record = {
      name: "Fighter",
      source: "PHB",
      edition: "classic",
      hitDie: 10,
      json: { name: "Fighter", source: "PHB", entries: ["A master of martial combat."] },
    };
    expect(classRecordSchema.parse(record)).toEqual(record);
  });
});

describe("subclassRecordSchema", () => {
  it("accepts a subclass, keyed by its class as well as its own name and source", () => {
    const record = {
      name: "Path of the Berserker",
      source: "PHB",
      shortName: "Berserker",
      className: "Barbarian",
      classSource: "PHB",
      edition: "classic",
      json: { name: "Path of the Berserker", source: "PHB" },
    };
    expect(subclassRecordSchema.parse(record)).toEqual(record);
  });
});

describe("classGrantsSchema", () => {
  it("accepts what a class grants by one level, empty arrays included", () => {
    const grants = {
      level: 7,
      resources: [{ resourceKey: "rages", value: "3" }],
      spellSlots: [],
      optionalFeatures: [],
      features: [
        {
          name: "Ability Score Improvement",
          source: "PHB",
          level: 6,
          json: { name: "Ability Score Improvement", source: "PHB" },
        },
      ],
    };
    expect(classGrantsSchema.parse(grants)).toEqual(grants);
  });
});

describe("homebrewClassInputSchema", () => {
  it("accepts a name, hd and an edition without a source", () => {
    const parsed = homebrewClassInputSchema.parse({
      name: "Warden",
      hd: { number: 1, faces: 10 },
      edition: "one",
    });
    expect(parsed).toEqual({ name: "Warden", hd: { number: 1, faces: 10 }, edition: "one" });
  });

  it("keeps a field this schema does not model, such as proficiency", () => {
    const withUnmodeledFields = {
      name: "Warden",
      hd: { number: 1, faces: 10 },
      edition: "one",
      proficiency: ["str", "con"],
    };
    expect(homebrewClassInputSchema.parse(withUnmodeledFields)).toEqual(withUnmodeledFields);
  });

  it("rejects a missing hd, naming the failed field", () => {
    const result = homebrewClassInputSchema.safeParse({ name: "Warden", edition: "one" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["hd"]);
  });

  it("rejects an hd rolling more than one die", () => {
    const result = homebrewClassInputSchema.safeParse({
      name: "Warden",
      hd: { number: 2, faces: 10 },
      edition: "one",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["hd", "number"]);
  });

  it("rejects an edition outside the two rulesets", () => {
    const result = homebrewClassInputSchema.safeParse({
      name: "Warden",
      hd: { number: 1, faces: 10 },
      edition: "3.5",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["edition"]);
  });
});

describe("homebrewClassRecordSchema", () => {
  it("accepts a stored row", () => {
    const record = {
      id: "1",
      name: "Warden",
      edition: "one",
      hitDie: 10,
      json: { name: "Warden", source: "HB", hd: { number: 1, faces: 10 } },
      createdAt: new Date(0).toISOString(),
    };
    expect(homebrewClassRecordSchema.parse(record)).toEqual(record);
  });
});

describe("preparedSpellCountSchema", () => {
  it("accepts the printed count for a class that prepares", () => {
    const count = { prepares: true, count: 6 };
    expect(preparedSpellCountSchema.parse(count)).toEqual(count);
  });

  it("accepts a class that carries no such column, with no count alongside", () => {
    const count = { prepares: false };
    expect(preparedSpellCountSchema.parse(count)).toEqual(count);
  });

  it("rejects a count on a class that does not prepare", () => {
    expect(() => preparedSpellCountSchema.parse({ prepares: false, count: 0 })).toThrow();
  });
});

describe("spellcastingAbilitySchema", () => {
  it("reads the ability a class casts with", () => {
    expect(spellcastingAbilitySchema.parse({ name: "Wizard", spellcastingAbility: "int" })).toBe(
      "int",
    );
  });

  it("is undefined for a class that casts none", () => {
    expect(spellcastingAbilitySchema.parse({ name: "Fighter" })).toBeUndefined();
  });
});
