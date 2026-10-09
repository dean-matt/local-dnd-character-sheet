import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  getClass,
  getClassGrants,
  getPreparedSpellCount,
  getSubclass,
  getSubclassGrants,
  listClasses,
  listSubclasses,
} from "./classes.ts";
import { publishClasses } from "./contentFixture.ts";

const CLERIC_PHB = {
  name: "Cleric",
  source: "PHB",
  edition: "classic",
  hit_die: 8,
  json: JSON.stringify({ name: "Cleric", source: "PHB" }),
};

const FIGHTER_PHB = {
  name: "Fighter",
  source: "PHB",
  edition: "classic",
  hit_die: 10,
  json: JSON.stringify({ name: "Fighter", source: "PHB" }),
};

const CLERIC_XPHB = {
  name: "Cleric",
  source: "XPHB",
  edition: "one",
  hit_die: 8,
  json: JSON.stringify({ name: "Cleric", source: "XPHB" }),
};

describe("content class queries", () => {
  let dataDir: string;

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "content-classes-"));
    publishClasses(dataDir, { classes: [CLERIC_PHB, FIGHTER_PHB, CLERIC_XPHB] });
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists classes filtered to one edition, sorted by name then source", () => {
    expect(listClasses(dataDir, "classic")).toEqual([CLERIC_PHB, FIGHTER_PHB]);
    expect(listClasses(dataDir, "one")).toEqual([CLERIC_XPHB]);
  });

  it("reads one class by name and source", () => {
    expect(getClass(dataDir, "Cleric", "PHB")).toEqual(CLERIC_PHB);
    expect(getClass(dataDir, "Nonexistent", "PHB")).toBeUndefined();
  });
});

const LIFE_DOMAIN = {
  name: "Life Domain",
  source: "PHB",
  short_name: "Life",
  class_name: "Cleric",
  class_source: "PHB",
  edition: "classic",
  json: JSON.stringify({ name: "Life Domain", source: "PHB" }),
};

describe("content subclass queries", () => {
  let dataDir: string;

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "content-subclasses-"));
    publishClasses(dataDir, { classes: [CLERIC_PHB, FIGHTER_PHB], subclasses: [LIFE_DOMAIN] });
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists the subclasses of one class, filtered to one edition", () => {
    expect(listSubclasses(dataDir, "Cleric", "PHB", "classic")).toEqual([LIFE_DOMAIN]);
    expect(listSubclasses(dataDir, "Fighter", "PHB", "classic")).toEqual([]);
  });

  it("reads one subclass by its own key and its class's", () => {
    expect(getSubclass(dataDir, "Life Domain", "PHB", "Cleric", "PHB")).toEqual(LIFE_DOMAIN);
    expect(getSubclass(dataDir, "Life Domain", "PHB", "Fighter", "PHB")).toBeUndefined();
  });
});

describe("class grants at a level", () => {
  let dataDir: string;

  const CLERIC_SPELLCASTING = {
    name: "Spellcasting",
    source: "PHB",
    class_name: "Cleric",
    class_source: "PHB",
    level: 1,
    edition: "classic",
    json: JSON.stringify({ name: "Spellcasting", source: "PHB" }),
  };

  const CLERIC_DIVINE_DOMAIN = {
    name: "Divine Domain",
    source: "PHB",
    class_name: "Cleric",
    class_source: "PHB",
    level: 1,
    edition: "classic",
    json: JSON.stringify({ name: "Divine Domain", source: "PHB" }),
  };

  const CLERIC_CHANNEL_DIVINITY = {
    name: "Channel Divinity",
    source: "PHB",
    class_name: "Cleric",
    class_source: "PHB",
    level: 2,
    edition: "classic",
    json: JSON.stringify({ name: "Channel Divinity", source: "PHB" }),
  };

  const FIGHTER_FIGHTING_STYLE = {
    name: "Fighting Style",
    source: "PHB",
    class_name: "Fighter",
    class_source: "PHB",
    level: 1,
    edition: "classic",
    json: JSON.stringify({ name: "Fighting Style", source: "PHB" }),
  };

  const NO_CHOICE = { choose: null, offered_by_name: null, offered_by_source: null };

  const asFeature = (row: { name: string; source: string; level: number; json: string }) => ({
    name: row.name,
    source: row.source,
    level: row.level,
    json: row.json,
    ...NO_CHOICE,
  });

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "content-class-grants-"));
    publishClasses(dataDir, {
      classes: [CLERIC_PHB, FIGHTER_PHB],
      classResources: [
        {
          class_name: "Cleric",
          class_source: "PHB",
          level: 1,
          resource_key: "cantrips_known",
          value: "3",
        },
        {
          class_name: "Cleric",
          class_source: "PHB",
          level: 2,
          resource_key: "cantrips_known",
          value: "3",
        },
        {
          class_name: "Cleric",
          class_source: "PHB",
          level: 2,
          resource_key: "channel_divinity",
          value: "1",
        },
        {
          class_name: "Fighter",
          class_source: "PHB",
          level: 1,
          resource_key: "second_wind",
          value: "1",
        },
      ],
      spellSlots: [
        { class_name: "Cleric", class_source: "PHB", level: 1, slot_level: 1, slots: 2 },
        { class_name: "Cleric", class_source: "PHB", level: 2, slot_level: 1, slots: 3 },
      ],
      classOptionalFeatures: [
        { class_name: "Fighter", class_source: "PHB", level: 1, feature_type: "FS:F", known: 1 },
      ],
      classFeatures: [
        CLERIC_SPELLCASTING,
        CLERIC_DIVINE_DOMAIN,
        CLERIC_CHANNEL_DIVINITY,
        FIGHTER_FIGHTING_STYLE,
      ],
    });
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("reads resources and slots at exactly one level, and features cumulative through it", () => {
    expect(getClassGrants(dataDir, "Cleric", "PHB", 2)).toEqual({
      resources: [
        { resource_key: "cantrips_known", value: "3" },
        { resource_key: "channel_divinity", value: "1" },
      ],
      spellSlots: [{ slot_level: 1, slots: 3 }],
      optionalFeatures: [],
      // Level 1 features order by name: Divine Domain before Spellcasting.
      features: [
        asFeature(CLERIC_DIVINE_DOMAIN),
        asFeature(CLERIC_SPELLCASTING),
        asFeature(CLERIC_CHANNEL_DIVINITY),
      ],
    });
  });

  it("scopes to the class asked for — a second class's rows never leak in", () => {
    expect(getClassGrants(dataDir, "Fighter", "PHB", 1)).toEqual({
      resources: [{ resource_key: "second_wind", value: "1" }],
      spellSlots: [],
      optionalFeatures: [{ feature_type: "FS:F", known: 1 }],
      features: [asFeature(FIGHTER_FIGHTING_STYLE)],
    });
  });

  it("returns empty arrays for a level the class grants nothing new at, not undefined", () => {
    expect(getClassGrants(dataDir, "Cleric", "PHB", 5)).toEqual({
      resources: [],
      spellSlots: [],
      optionalFeatures: [],
      features: [
        asFeature(CLERIC_DIVINE_DOMAIN),
        asFeature(CLERIC_SPELLCASTING),
        asFeature(CLERIC_CHANNEL_DIVINITY),
      ],
    });
  });
});

describe("prepared spell count", () => {
  let dataDir: string;

  const BARD_XPHB = {
    name: "Bard",
    source: "XPHB",
    edition: "one",
    hit_die: 8,
    json: JSON.stringify({ name: "Bard", source: "XPHB" }),
  };

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("reads the printed count for a class that never prepared under classic", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-prepared-spells-"));
    publishClasses(dataDir, {
      classes: [BARD_XPHB],
      classResources: [
        {
          class_name: "Bard",
          class_source: "XPHB",
          level: 1,
          resource_key: "prepared_spells",
          value: "4",
        },
        {
          class_name: "Bard",
          class_source: "XPHB",
          level: 2,
          resource_key: "prepared_spells",
          value: "5",
        },
      ],
    });

    expect(getPreparedSpellCount(dataDir, "Bard", "XPHB", 2)).toEqual({
      prepares: true,
      count: 5,
    });
  });

  it("reads zero for a level the class has not reached the column yet", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-prepared-spells-"));
    publishClasses(dataDir, {
      classes: [BARD_XPHB],
      classResources: [
        {
          class_name: "Bard",
          class_source: "XPHB",
          level: 3,
          resource_key: "prepared_spells",
          value: "6",
        },
      ],
    });

    expect(getPreparedSpellCount(dataDir, "Bard", "XPHB", 1)).toEqual({
      prepares: true,
      count: 0,
    });
  });

  it("throws on a stored value that is not a non-negative integer", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-prepared-spells-"));
    publishClasses(dataDir, {
      classes: [BARD_XPHB],
      classResources: [
        {
          class_name: "Bard",
          class_source: "XPHB",
          level: 1,
          resource_key: "prepared_spells",
          value: "many",
        },
      ],
    });

    expect(() => getPreparedSpellCount(dataDir, "Bard", "XPHB", 1)).toThrow(
      /prepared_spells value many is not a count/,
    );
  });

  it("says a class does not prepare at all, distinct from reading zero", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-prepared-spells-"));
    publishClasses(dataDir, { classes: [FIGHTER_PHB] });

    expect(getPreparedSpellCount(dataDir, "Fighter", "PHB", 5)).toEqual({ prepares: false });
  });
});

describe("subclass grants at a level", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("reads a subclass's own resources and features, keyed by its short name", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-subclass-grants-"));
    const bonusHealing = {
      class_name: "Cleric",
      class_source: "PHB",
      subclass_name: "Life Domain",
      subclass_source: "PHB",
      level: 1,
      resource_key: "bonus_healing",
      value: "2",
    };
    const discipleOfLife = {
      name: "Disciple of Life",
      source: "PHB",
      class_name: "Cleric",
      class_source: "PHB",
      subclass_short_name: "Life",
      subclass_source: "PHB",
      level: 1,
      edition: "classic",
      json: JSON.stringify({ name: "Disciple of Life", source: "PHB" }),
    };
    publishClasses(dataDir, {
      classes: [CLERIC_PHB],
      subclasses: [LIFE_DOMAIN],
      subclassResources: [bonusHealing],
      subclassFeatures: [discipleOfLife],
    });

    const grants = getSubclassGrants(dataDir, "Cleric", "PHB", "Life Domain", "Life", "PHB", 1);

    expect(grants).toEqual({
      resources: [{ resource_key: "bonus_healing", value: "2" }],
      spellSlots: [],
      optionalFeatures: [],
      features: [
        {
          name: "Disciple of Life",
          source: "PHB",
          level: 1,
          json: discipleOfLife.json,
          choose: null,
          offered_by_name: null,
          offered_by_source: null,
        },
      ],
    });
  });
});
