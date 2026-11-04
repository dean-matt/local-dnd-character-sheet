import { describe, expect, it } from "vitest";
import {
  casterProgressionSchema,
  castingStartLevelSchema,
  classGrantsSchema,
  classRecordSchema,
  homebrewClassFeaturesInputSchema,
  homebrewClassFeaturesSchema,
  homebrewClassInputSchema,
  homebrewClassRecordSchema,
  homebrewSubclassInputSchema,
  optionalFeatureCountsSchema,
  preparationRuleSchema,
  preparedSpellCountSchema,
  sameSubclassParent,
  spellbookGainsSchema,
  spellcastingAbilitySchema,
  subclassLevelSchema,
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

describe("homebrew class feature lists", () => {
  const legacy = [{ name: "Fury | Rage", level: 1, entries: ["x"] }];

  it("reads a stored name containing | or } and refuses it on input", () => {
    expect(homebrewClassFeaturesSchema.parse(legacy)).toEqual(legacy);
    const result = homebrewClassFeaturesInputSchema.safeParse(legacy);
    expect(result.error?.issues[0]?.message).toBe('Feature "Fury | Rage" cannot contain "|"');
    expect(homebrewClassFeaturesInputSchema.safeParse([{ ...legacy[0], name: "A}" }]).success).toBe(
      false,
    );
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

  it("takes a subclass level of 1 to 20, and none", () => {
    const warden = { name: "Warden", hd: { number: 1, faces: 10 }, edition: "one" };
    expect(homebrewClassInputSchema.parse({ ...warden, subclassLevel: 20 }).subclassLevel).toBe(20);
    expect(homebrewClassInputSchema.parse(warden).subclassLevel).toBeUndefined();
    for (const subclassLevel of [0, 21, 2.5, "3"]) {
      expect(homebrewClassInputSchema.safeParse({ ...warden, subclassLevel }).success).toBe(false);
    }
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

describe("castingStartLevelSchema", () => {
  it("reads the lowest class level any additionalSpells map grants a spell at", () => {
    const row = {
      additionalSpells: [
        { known: { "3": ["mage hand#c"] }, expanded: { s1: ["shield"], "7": [] } },
        { innate: { "10": ["augury"] } },
      ],
    };
    expect(castingStartLevelSchema.parse(row)).toBe(3);
  });

  it("is undefined for a row that lists no spells by class level", () => {
    expect(castingStartLevelSchema.parse({ name: "Way of the Four Elements" })).toBeUndefined();
    expect(
      castingStartLevelSchema.parse({ additionalSpells: [{ expanded: { s1: [] } }] }),
    ).toBeUndefined();
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

describe("casterProgressionSchema", () => {
  it("reads the progression a row states, and none where it states none", () => {
    expect(casterProgressionSchema.parse({ casterProgression: "1/3" })).toBe("1/3");
    expect(casterProgressionSchema.parse({ name: "Fighter" })).toBeUndefined();
  });

  it("rejects a progression the multiclass rule has no contribution for", () => {
    expect(casterProgressionSchema.safeParse({ casterProgression: "1/4" }).success).toBe(false);
  });
});

describe("preparationRuleSchema", () => {
  it("reads the level a classic formula counts", () => {
    expect(preparationRuleSchema.parse({ preparedSpells: "<$level$> + <$wis_mod$>" })).toBe(
      "level",
    );
    expect(preparationRuleSchema.parse({ preparedSpells: "<$level$> / 2 + <$cha_mod$>" })).toBe(
      "half-level",
    );
  });

  it("reads no rule off a row that prints no formula, or one that counts no level", () => {
    expect(preparationRuleSchema.parse({ name: "Wizard" })).toBeUndefined();
    expect(preparationRuleSchema.parse({ preparedSpells: "<$int_mod$>" })).toBeUndefined();
  });
});

describe("spellbookGainsSchema", () => {
  it("reads the spells a class copies into its spellbook at each level", () => {
    const gains = [6, 2, 2];
    expect(spellbookGainsSchema.parse({ spellsKnownProgressionFixed: gains })).toEqual(gains);
  });

  it("is undefined for a class that keeps no spellbook", () => {
    expect(spellbookGainsSchema.parse({ name: "Cleric" })).toBeUndefined();
  });
});

describe("subclassLevelSchema", () => {
  const gains = (classFeature: string) => ({ classFeature, gainSubclassFeature: true });

  it("reads the level of the first feature that grants the subclass", () => {
    const cleric = {
      classFeatures: [
        "Spellcasting|Cleric||1",
        gains("Divine Domain|Cleric||1"),
        gains("Channel Divinity|Cleric||2"),
      ],
    };
    expect(subclassLevelSchema.parse(cleric)).toBe(1);
  });

  it("reads past a trailing feature source", () => {
    const artificer = { classFeatures: [gains("Artificer Subclass|Artificer|EFA|3|EFA")] };
    expect(subclassLevelSchema.parse(artificer)).toBe(3);
  });

  it("is undefined for a class that grants no subclass", () => {
    expect(subclassLevelSchema.parse({ classFeatures: ["Rage|Barbarian||1"] })).toBeUndefined();
    expect(subclassLevelSchema.parse({})).toBeUndefined();
  });
});

describe("sameSubclassParent", () => {
  const cleric = { name: "Cleric", source: "PHB" };

  it("matches a catalog class by exact name and source, and a homebrew class by id", () => {
    expect(sameSubclassParent(cleric, { ...cleric })).toBe(true);
    expect(sameSubclassParent({ classId: "c1" }, { classId: "c1" })).toBe(true);
  });

  it("tells apart another edition's class, a change of case, another id and a homebrew class", () => {
    expect(sameSubclassParent(cleric, { name: "Cleric", source: "XPHB" })).toBe(false);
    expect(sameSubclassParent(cleric, { name: "cleric", source: "PHB" })).toBe(false);
    expect(sameSubclassParent({ classId: "c1" }, { classId: "c2" })).toBe(false);
    expect(sameSubclassParent(cleric, { classId: "c1" })).toBe(false);
  });
});

describe("optionalFeatureCountsSchema", () => {
  const block = (progression: unknown, featureType = ["EI"]) => ({ featureType, progression });

  it("reads a count per level, carrying a sparse progression's count forward", () => {
    const dense = [0, 2, ...Array<number>(18).fill(3)];
    expect(
      optionalFeatureCountsSchema.parse({
        optionalfeatureProgression: [block(dense), block({ "3": 2, "10": 3 }, ["MM"])],
      }),
    ).toEqual([
      { featureType: "EI", known: dense },
      {
        featureType: "MM",
        known: [0, 0, ...Array<number>(7).fill(2), ...Array<number>(11).fill(3)],
      },
    ]);
  });

  it("counts none for an entry stating none, or one stored in a shape it cannot read", () => {
    expect(optionalFeatureCountsSchema.parse({})).toEqual([]);
    expect(optionalFeatureCountsSchema.parse({ optionalfeatureProgression: "EI" })).toEqual([]);
  });

  it("holds a homebrew class or subclass to 20 levels, one type a count, each type once", () => {
    const parent = { name: "Fighter", source: "PHB" };
    const accepts = (optionalfeatureProgression: unknown) =>
      homebrewSubclassInputSchema.safeParse({ name: "Grove", parent, optionalfeatureProgression })
        .success;
    expect(accepts([block({ "1": 1 })])).toBe(true);
    expect(accepts([block([1, 2])])).toBe(false);
    expect(accepts([block({ "21": 1 })])).toBe(false);
    expect(accepts([block({ "1": 1 }, ["EI", "MM"])])).toBe(false);
    expect(accepts([block({ "1": 1 }), block({ "5": 2 })])).toBe(false);
    expect(
      homebrewClassInputSchema.safeParse({
        name: "Warden",
        edition: "one",
        hd: { number: 1, faces: 10 },
        optionalfeatureProgression: [block({ "1": 1 })],
      }).success,
    ).toBe(true);
  });
});
