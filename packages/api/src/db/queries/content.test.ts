import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  escapeLikeTerm,
  getBackground,
  getCatalogMeta,
  getCatalogVersion,
  getClass,
  getClassGrants,
  getFeat,
  getItem,
  getPreparedSpellCount,
  getRace,
  getSpell,
  getSubclass,
  getSubclassGrants,
  getSubrace,
  listBackgrounds,
  listClasses,
  listFeats,
  listItems,
  listRaces,
  listSpells,
  listSubclasses,
  listSubraces,
  searchCatalog,
} from "./content.ts";
import {
  publishBackgrounds,
  publishClasses,
  publishFeats,
  publishItems,
  publishMeta,
  publishRaces,
  publishSearchFixture,
  publishSpells,
  publishSubraces,
} from "./contentFixture.ts";

const FIREBALL = {
  name: "Fireball",
  source: "PHB",
  edition: "classic",
  level: 3,
  school: "V",
  concentration: 0 as const,
  ritual: 0 as const,
  json: JSON.stringify({ name: "Fireball", source: "PHB", level: 3, school: "V" }),
};

const GOODBERRY_ONE = {
  name: "Goodberry",
  source: "XPHB",
  edition: "one",
  level: 1,
  school: "C",
  concentration: 0 as const,
  ritual: 0 as const,
  json: JSON.stringify({ name: "Goodberry", source: "XPHB", level: 1, school: "C" }),
};

describe("content spell queries", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists spells filtered to one edition, sorted by name then source", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-spells-"));
    publishSpells(dataDir, [FIREBALL, GOODBERRY_ONE]);

    expect(listSpells(dataDir, "classic")).toEqual([FIREBALL]);
    expect(listSpells(dataDir, "one")).toEqual([GOODBERRY_ONE]);
  });

  it("reads one spell by name and source", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-spells-"));
    publishSpells(dataDir, [FIREBALL]);

    expect(getSpell(dataDir, "Fireball", "PHB")).toEqual(FIREBALL);
    expect(getSpell(dataDir, "Fireball", "XPHB")).toBeUndefined();
    expect(getSpell(dataDir, "Nonexistent", "PHB")).toBeUndefined();
  });
});

const ELF = {
  name: "Elf",
  source: "PHB",
  edition: "classic",
  json: JSON.stringify({ name: "Elf", source: "PHB" }),
};

const TIEFLING_ONE = {
  name: "Tiefling",
  source: "XPHB",
  edition: "one",
  json: JSON.stringify({ name: "Tiefling", source: "XPHB" }),
};

describe("content race queries", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists races filtered to one edition, sorted by name then source", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-races-"));
    publishRaces(dataDir, [ELF, TIEFLING_ONE]);

    expect(listRaces(dataDir, "classic")).toEqual([ELF]);
    expect(listRaces(dataDir, "one")).toEqual([TIEFLING_ONE]);
  });

  it("reads one race by name and source", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-races-"));
    publishRaces(dataDir, [ELF]);

    expect(getRace(dataDir, "Elf", "PHB")).toEqual(ELF);
    expect(getRace(dataDir, "Nonexistent", "PHB")).toBeUndefined();
  });
});

const HIGH_ELF = {
  name: "High",
  source: "PHB",
  race_name: "Elf",
  race_source: "PHB",
  edition: "classic",
  json: JSON.stringify({ name: "High", source: "PHB" }),
};

const WOOD_ELF = {
  name: "Wood",
  source: "PHB",
  race_name: "Elf",
  race_source: "PHB",
  edition: "classic",
  json: JSON.stringify({ name: "Wood", source: "PHB" }),
};

const HUMAN_BASE = {
  name: "",
  source: "PHB",
  race_name: "Human",
  race_source: "PHB",
  edition: "classic",
  json: JSON.stringify({ name: "Human", source: "PHB" }),
};

describe("content subrace queries", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists subraces of one race, filtered to one edition", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-subraces-"));
    publishSubraces(dataDir, [HIGH_ELF, WOOD_ELF, HUMAN_BASE]);

    expect(listSubraces(dataDir, "Elf", "PHB", "classic")).toEqual([HIGH_ELF, WOOD_ELF]);
    expect(listSubraces(dataDir, "Human", "PHB", "classic")).toEqual([HUMAN_BASE]);
  });

  it("reads one subrace by its own key and its race's", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-subraces-"));
    publishSubraces(dataDir, [HIGH_ELF]);

    expect(getSubrace(dataDir, "High", "PHB", "Elf", "PHB")).toEqual(HIGH_ELF);
    expect(getSubrace(dataDir, "High", "PHB", "Gnome", "PHB")).toBeUndefined();
  });

  it("allows the empty subrace name a base variant with no subrace of its own carries", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-subraces-"));
    publishSubraces(dataDir, [HUMAN_BASE]);

    expect(getSubrace(dataDir, "", "PHB", "Human", "PHB")).toEqual(HUMAN_BASE);
  });
});

const ACOLYTE = {
  name: "Acolyte",
  source: "PHB",
  edition: "classic",
  json: JSON.stringify({ name: "Acolyte", source: "PHB" }),
};

describe("content background queries", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists backgrounds filtered to one edition", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-backgrounds-"));
    publishBackgrounds(dataDir, [ACOLYTE]);

    expect(listBackgrounds(dataDir, "classic")).toEqual([ACOLYTE]);
    expect(listBackgrounds(dataDir, "one")).toEqual([]);
  });

  it("reads one background by name and source", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-backgrounds-"));
    publishBackgrounds(dataDir, [ACOLYTE]);

    expect(getBackground(dataDir, "Acolyte", "PHB")).toEqual(ACOLYTE);
    expect(getBackground(dataDir, "Nonexistent", "PHB")).toBeUndefined();
  });
});

const ALERT = {
  name: "Alert",
  source: "PHB",
  edition: "classic",
  json: JSON.stringify({ name: "Alert", source: "PHB" }),
};

describe("content feat queries", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists feats filtered to one edition", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-feats-"));
    publishFeats(dataDir, [ALERT]);

    expect(listFeats(dataDir, "classic")).toEqual([ALERT]);
    expect(listFeats(dataDir, "one")).toEqual([]);
  });

  it("reads one feat by name and source", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-feats-"));
    publishFeats(dataDir, [ALERT]);

    expect(getFeat(dataDir, "Alert", "PHB")).toEqual(ALERT);
    expect(getFeat(dataDir, "Nonexistent", "PHB")).toBeUndefined();
  });
});

const LONGSWORD = {
  name: "Longsword",
  source: "PHB",
  edition: "classic",
  kind: "baseitem",
  type: "M",
  rarity: null,
  requires_attunement: 0 as const,
  json: JSON.stringify({ name: "Longsword", source: "PHB" }),
};

const DEMON_ARMOR = {
  name: "Demon Armor",
  source: "DMG",
  edition: "classic",
  kind: "item",
  type: "HA",
  rarity: "very rare",
  requires_attunement: 1 as const,
  json: JSON.stringify({ name: "Demon Armor", source: "DMG" }),
};

const BAG_OF_TRICKS = {
  name: "Bag of Tricks",
  source: "DMG",
  edition: "classic",
  kind: "itemGroup",
  type: null,
  rarity: "uncommon",
  requires_attunement: 0 as const,
  json: JSON.stringify({ name: "Bag of Tricks", source: "DMG" }),
};

describe("content item queries", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists only item and baseitem kinds, filtered to one edition", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-items-"));
    publishItems(dataDir, [LONGSWORD, DEMON_ARMOR, BAG_OF_TRICKS]);

    expect(listItems(dataDir, "classic")).toEqual([DEMON_ARMOR, LONGSWORD]);
  });

  it("reads one item by name and source, whatever its kind", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-items-"));
    publishItems(dataDir, [LONGSWORD, BAG_OF_TRICKS]);

    expect(getItem(dataDir, "Longsword", "PHB")).toEqual(LONGSWORD);
    expect(getItem(dataDir, "Bag of Tricks", "DMG")).toEqual(BAG_OF_TRICKS);
    expect(getItem(dataDir, "Nonexistent", "PHB")).toBeUndefined();
  });
});

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

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists classes filtered to one edition, sorted by name then source", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-classes-"));
    publishClasses(dataDir, { classes: [CLERIC_PHB, FIGHTER_PHB, CLERIC_XPHB] });

    expect(listClasses(dataDir, "classic")).toEqual([CLERIC_PHB, FIGHTER_PHB]);
    expect(listClasses(dataDir, "one")).toEqual([CLERIC_XPHB]);
  });

  it("reads one class by name and source", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-classes-"));
    publishClasses(dataDir, { classes: [CLERIC_PHB] });

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

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists the subclasses of one class, filtered to one edition", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-subclasses-"));
    publishClasses(dataDir, { classes: [CLERIC_PHB, FIGHTER_PHB], subclasses: [LIFE_DOMAIN] });

    expect(listSubclasses(dataDir, "Cleric", "PHB", "classic")).toEqual([LIFE_DOMAIN]);
    expect(listSubclasses(dataDir, "Fighter", "PHB", "classic")).toEqual([]);
  });

  it("reads one subclass by its own key and its class's", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-subclasses-"));
    publishClasses(dataDir, { classes: [CLERIC_PHB], subclasses: [LIFE_DOMAIN] });

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

  const asFeature = (row: { name: string; source: string; level: number; json: string }) => ({
    name: row.name,
    source: row.source,
    level: row.level,
    json: row.json,
  });

  const setUp = () => {
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
  };

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("reads resources and slots at exactly one level, and features cumulative through it", () => {
    setUp();

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
    setUp();

    expect(getClassGrants(dataDir, "Fighter", "PHB", 1)).toEqual({
      resources: [{ resource_key: "second_wind", value: "1" }],
      spellSlots: [],
      optionalFeatures: [{ feature_type: "FS:F", known: 1 }],
      features: [asFeature(FIGHTER_FIGHTING_STYLE)],
    });
  });

  it("returns empty arrays for a level the class grants nothing new at, not undefined", () => {
    setUp();

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
        },
      ],
    });
  });
});

describe("escapeLikeTerm", () => {
  it("escapes a percent, an underscore and the escape character itself", () => {
    expect(escapeLikeTerm("50%")).toBe("50!%");
    expect(escapeLikeTerm("under_score")).toBe("under!_score");
    expect(escapeLikeTerm("bang!")).toBe("bang!!");
  });
});

const FIRE_ELEMENTAL = {
  type: "monster",
  name: "Fire Elemental",
  source: "MM",
  qualifier: "",
  edition: null,
  json: JSON.stringify({ name: "Fire Elemental", source: "MM" }),
  rendered_text: "Fire Elemental. A fire elemental is a mass of elemental fire.",
};

const GELATINOUS_CUBE = {
  type: "monster",
  name: "Gelatinous Cube",
  source: "MM",
  qualifier: "",
  edition: null,
  json: JSON.stringify({ name: "Gelatinous Cube", source: "MM" }),
  rendered_text: "Gelatinous Cube. A nearly transparent ooze.",
};

describe("searchCatalog", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("matches a Tier A row by a case-insensitive substring and a Tier C row via FTS, in one list", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    publishSearchFixture(dataDir, {
      spells: [FIREBALL, GOODBERRY_ONE],
      entities: [FIRE_ELEMENTAL, GELATINOUS_CUBE],
    });

    const hits = searchCatalog(dataDir, "classic", "fire");

    expect(hits).toEqual(
      expect.arrayContaining([
        { type: "spell", name: "Fireball", source: "PHB", edition: "classic" },
        { type: "monster", name: "Fire Elemental", source: "MM", edition: null },
      ]),
    );
    expect(hits).toHaveLength(2);
  });

  it("filters a Tier A row to the requested edition, and includes an edition-less Tier C row regardless", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    publishSearchFixture(dataDir, {
      spells: [FIREBALL, GOODBERRY_ONE],
      entities: [FIRE_ELEMENTAL],
    });

    const hits = searchCatalog(dataDir, "one", "fire");

    expect(hits).toEqual([
      { type: "monster", name: "Fire Elemental", source: "MM", edition: null },
    ]);
  });

  it("narrows to one type across both tiers", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    publishSearchFixture(dataDir, { spells: [FIREBALL], entities: [FIRE_ELEMENTAL] });

    expect(searchCatalog(dataDir, "classic", "fire", "spell")).toEqual([
      { type: "spell", name: "Fireball", source: "PHB", edition: "classic" },
    ]);
    expect(searchCatalog(dataDir, "classic", "fire", "monster")).toEqual([
      { type: "monster", name: "Fire Elemental", source: "MM", edition: null },
    ]);
  });

  it("finds nothing for a term no row's name or rendered text holds", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    publishSearchFixture(dataDir, { spells: [FIREBALL], entities: [FIRE_ELEMENTAL] });

    expect(searchCatalog(dataDir, "classic", "nonexistent")).toEqual([]);
  });
});

describe("getCatalogMeta", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("returns the meta rows once a catalog has been built", () => {
    dataDir = mkdtempSync(join(tmpdir(), "catalog-meta-"));
    publishMeta(dataDir, [
      { key: "upstream_tag", value: "v2.34.1" },
      { key: "built_at", value: "2026-01-01T00:00:00.000Z" },
    ]);

    expect(getCatalogMeta(dataDir)).toEqual([
      { key: "built_at", value: "2026-01-01T00:00:00.000Z" },
      { key: "upstream_tag", value: "v2.34.1" },
    ]);
  });

  it("returns undefined when no catalog has ever been built", () => {
    dataDir = mkdtempSync(join(tmpdir(), "catalog-meta-"));
    expect(getCatalogMeta(dataDir)).toBeUndefined();
  });
});

describe("getCatalogVersion", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("reads the upstream tag out of the meta rows", () => {
    dataDir = mkdtempSync(join(tmpdir(), "catalog-version-"));
    publishMeta(dataDir, [{ key: "upstream_tag", value: "v2.34.1" }]);

    expect(getCatalogVersion(dataDir)).toBe("v2.34.1");
  });

  it("is undefined before a catalog has been built", () => {
    dataDir = mkdtempSync(join(tmpdir(), "catalog-version-"));
    expect(getCatalogVersion(dataDir)).toBeUndefined();
  });
});
