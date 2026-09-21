import { describe, expect, it } from "vitest";
import {
  classGrantsSchema,
  classRecordSchema,
  preparedSpellCountSchema,
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
