import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listSearchSources, listSearchTypes, searchCatalog } from "./catalog-search.ts";
import { publishSearchFixture } from "./contentFixture.ts";

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

const FIRE_ELEMENTAL = {
  type: "monster",
  name: "Fire Elemental",
  source: "MM",
  qualifier: "",
  edition: null,
  json: JSON.stringify({ name: "Fire Elemental", source: "MM", entries: ["Fire Elemental."] }),
  rendered_text: "Fire Elemental. A fire elemental is a mass of elemental fire.",
};

const GELATINOUS_CUBE = {
  type: "monster",
  name: "Gelatinous Cube",
  source: "MM",
  qualifier: "",
  edition: null,
  json: JSON.stringify({ name: "Gelatinous Cube", source: "MM", entries: ["Gelatinous Cube."] }),
  rendered_text: "Gelatinous Cube. A nearly transparent ooze.",
};

const RESTRAINED = {
  kind: "condition",
  name: "Restrained",
  source: "XPHB",
  edition: "one",
  json: JSON.stringify({ name: "Restrained", source: "XPHB", entries: ["Restrained."] }),
};

const battleMaster = (classSource: string) => ({
  name: "Battle Master",
  source: "PHB",
  short_name: "Battle Master",
  class_name: "Fighter",
  class_source: classSource,
  edition: "classic",
  json: "{}",
});

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

    const hits = searchCatalog(dataDir, { edition: "classic", term: "fire" });

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

    const hits = searchCatalog(dataDir, { edition: "one", term: "fire" });

    expect(hits).toEqual([
      { type: "monster", name: "Fire Elemental", source: "MM", edition: null },
    ]);
  });

  it("narrows to one type across both tiers", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    publishSearchFixture(dataDir, { spells: [FIREBALL], entities: [FIRE_ELEMENTAL] });

    expect(searchCatalog(dataDir, { edition: "classic", term: "fire", types: ["spell"] })).toEqual([
      { type: "spell", name: "Fireball", source: "PHB", edition: "classic" },
    ]);
    expect(
      searchCatalog(dataDir, { edition: "classic", term: "fire", types: ["monster"] }),
    ).toEqual([{ type: "monster", name: "Fire Elemental", source: "MM", edition: null }]);
  });

  it("reads both editions where none is named", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    publishSearchFixture(dataDir, { spells: [FIREBALL, GOODBERRY_ONE], entities: [] });

    expect(searchCatalog(dataDir, { types: ["spell"] })).toEqual([
      { type: "spell", name: "Fireball", source: "PHB", edition: "classic" },
      { type: "spell", name: "Goodberry", source: "XPHB", edition: "one" },
    ]);
  });

  it("lists every row of the named types for a blank term", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    publishSearchFixture(dataDir, {
      spells: [FIREBALL],
      entities: [FIRE_ELEMENTAL, GELATINOUS_CUBE],
    });

    expect(searchCatalog(dataDir, { edition: "classic", term: "", types: ["monster"] })).toEqual([
      { type: "monster", name: "Fire Elemental", source: "MM", edition: null },
      { type: "monster", name: "Gelatinous Cube", source: "MM", edition: null },
    ]);
  });

  it("narrows spells by level and school and passes every other kind through", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    const fireBolt = { ...FIREBALL, name: "Fire Bolt", level: 0 };
    const fireShield = { ...FIREBALL, name: "Fire Shield", level: 4, school: "A" };
    publishSearchFixture(dataDir, {
      spells: [FIREBALL, fireBolt, fireShield],
      entities: [FIRE_ELEMENTAL],
    });

    const names = (filter: Parameters<typeof searchCatalog>[1]) =>
      searchCatalog(dataDir, { edition: "classic", term: "fire", ...filter }).map((h) => h.name);

    expect(names({ spellLevels: { min: 1, max: 9 } })).toEqual([
      "Fireball",
      "Fire Shield",
      "Fire Elemental",
    ]);
    expect(names({ schools: ["V"] })).toEqual(["Fireball", "Fire Bolt", "Fire Elemental"]);
    expect(names({ spellLevels: { min: 3, max: 9 }, schools: ["V"], types: ["spell"] })).toEqual([
      "Fireball",
    ]);
  });

  it("narrows items by rarity and passes every other kind through", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    const item = (name: string, rarity: string) => ({
      name,
      source: "DMG",
      edition: "classic",
      kind: "item",
      type: null,
      rarity,
      requires_attunement: 0 as const,
      json: JSON.stringify({ name, source: "DMG" }),
    });
    publishSearchFixture(dataDir, {
      spells: [FIREBALL],
      items: [item("Flame Tongue", "rare"), item("Fire Opal", "none")],
      entities: [],
    });

    expect(
      searchCatalog(dataDir, { edition: "classic", term: "f", rarities: ["rare"] }).map(
        (h) => h.name,
      ),
    ).toEqual(["Fireball", "Flame Tongue"]);
  });

  it("narrows items by kind, read off the type and the flags, and passes every other kind through", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    const item = (name: string, type: string | null, flags: object = {}) => ({
      name,
      source: "DMG",
      edition: "classic",
      kind: "item",
      type,
      rarity: "rare",
      requires_attunement: 0 as const,
      json: JSON.stringify({ name, source: "DMG", ...flags }),
    });
    publishSearchFixture(dataDir, {
      spells: [FIREBALL],
      items: [
        item("Flame Tongue Shortsword", "M"),
        item("Fire Staff", "M|XPHB", { staff: true }),
        item("Fire Opal", "$G"),
        item("Firework Bag", null, { wondrous: true }),
      ],
      entities: [],
    });
    const names = (itemKinds: string[]) =>
      searchCatalog(dataDir, { edition: "classic", term: "f", itemKinds }).map((h) => h.name);

    expect(names(["melee"])).toEqual(["Fireball", "Flame Tongue Shortsword", "Fire Staff"]);
    expect(names(["staff", "wondrous"])).toEqual(["Fireball", "Fire Staff", "Firework Bag"]);
  });

  it("gives an item hit its kinds, rarity and weapon category", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    publishSearchFixture(dataDir, {
      spells: [FIREBALL],
      items: [
        {
          name: "Flame Tongue Longbow",
          source: "DMG",
          edition: "classic",
          kind: "item",
          type: "R",
          rarity: "rare",
          requires_attunement: 1 as const,
          json: JSON.stringify({ name: "Flame Tongue Longbow", weaponCategory: "martial" }),
        },
      ],
      entities: [],
    });

    expect(searchCatalog(dataDir, { term: "f" })).toEqual([
      { type: "spell", name: "Fireball", source: "PHB", edition: "classic" },
      {
        type: "item",
        name: "Flame Tongue Longbow",
        source: "DMG",
        edition: "classic",
        item: { kinds: ["ranged"], rarity: "rare", category: "martial" },
      },
    ]);
  });

  it("finds a magic variant and places it by the base items its requires and excludes admit", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    const row = (name: string, kind: string, fields: object) => ({
      name,
      source: "DMG",
      edition: "classic",
      kind,
      type: null,
      rarity: kind === "magicvariant" ? "uncommon" : "none",
      requires_attunement: 0 as const,
      json: JSON.stringify({ name, ...fields }),
    });
    publishSearchFixture(dataDir, {
      spells: [],
      items: [
        row("Longsword", "baseitem", { source: "PHB", type: "M", weapon: true, sword: true }),
        row("Longbow", "baseitem", { source: "PHB", type: "R", weapon: true, bow: true }),
        row("Net", "baseitem", { source: "PHB", type: "R", weapon: true, net: true }),
        row("Plate Armor", "baseitem", { source: "PHB", type: "HA", armor: true }),
        row("+1 Weapon", "magicvariant", {
          requires: [{ weapon: true }],
          excludes: { net: true },
          inherits: { source: "DMG", rarity: "uncommon" },
        }),
        row("+1 Armor", "magicvariant", {
          requires: [{ armor: true }],
          inherits: { source: "DMG", rarity: "uncommon" },
        }),
      ],
      entities: [],
    });
    const names = (itemKinds: string[]) =>
      searchCatalog(dataDir, { term: "+1", itemKinds }).map((h) => h.name);

    expect(names(["ranged"])).toEqual(["+1 Weapon"]);
    expect(names(["heavy"])).toEqual(["+1 Armor"]);
    expect(searchCatalog(dataDir, { term: "+1 W" })).toEqual([
      {
        type: "item",
        name: "+1 Weapon",
        source: "DMG",
        edition: "classic",
        item: { kinds: ["melee", "ranged"], rarity: "uncommon", category: null },
      },
    ]);
  });

  it("finds each rules lookup a reader looks up by name, and leaves out an abbreviation", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    publishSearchFixture(dataDir, {
      lookups: [
        RESTRAINED,
        { ...RESTRAINED, kind: "itemProperty", name: "R" },
        { ...RESTRAINED, kind: "deity", name: "Moradin", source: "PHB", qualifier: "Dwarven" },
      ],
    });

    expect(searchCatalog(dataDir, { term: "r" })).toEqual([
      { type: "condition", name: "Restrained", source: "XPHB", edition: "one" },
      { type: "deity", name: "Moradin", source: "PHB", qualifier: "Dwarven", edition: "one" },
    ]);
    expect(searchCatalog(dataDir, { types: ["deity"] })).toHaveLength(1);
  });

  it("finds a subclass once, under the class printed in its own source", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    publishSearchFixture(dataDir, { subclasses: [battleMaster("XPHB"), battleMaster("PHB")] });

    expect(searchCatalog(dataDir, { term: "battle" })).toEqual([
      {
        type: "subclass",
        name: "Battle Master",
        source: "PHB",
        parent: { name: "Fighter", source: "PHB" },
        edition: "classic",
      },
    ]);
  });

  it("marks a row with no rules text to show, a table's text being its rows and a monster's its stat block", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    const prose = (type: string, name: string) => ({
      ...FIRE_ELEMENTAL,
      type,
      name,
      json: JSON.stringify({ name }),
    });
    publishSearchFixture(dataDir, {
      entities: [
        prose("monster", "Fire Elemental"),
        {
          ...prose("legendaryGroup", "Fire Giant Dreadnought"),
          json: JSON.stringify({ lairActions: ["Lair."] }),
        },
        prose("legendaryGroup", "Fire Lairless"),
        prose("book", "Fire Book"),
      ],
      lookups: [
        {
          ...RESTRAINED,
          kind: "table",
          name: "Fire Tables",
          json: JSON.stringify({ rows: [["1"]] }),
        },
        { ...RESTRAINED, kind: "table", name: "Fire Blank", json: JSON.stringify({ rows: [] }) },
      ],
    });

    expect(searchCatalog(dataDir, { term: "fire" })).toEqual([
      { type: "table", name: "Fire Blank", source: "XPHB", textless: true, edition: "one" },
      { type: "table", name: "Fire Tables", source: "XPHB", edition: "one" },
      { type: "monster", name: "Fire Elemental", source: "MM", edition: null },
      { type: "legendaryGroup", name: "Fire Giant Dreadnought", source: "MM", edition: null },
      {
        type: "legendaryGroup",
        name: "Fire Lairless",
        source: "MM",
        textless: true,
        edition: null,
      },
      { type: "book", name: "Fire Book", source: "MM", textless: true, edition: null },
    ]);
  });

  it("carries a card's deck as its qualifier", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    publishSearchFixture(dataDir, {
      entities: [
        { ...FIRE_ELEMENTAL, type: "card", name: "Balance", qualifier: "Deck of Many Things" },
      ],
    });

    expect(searchCatalog(dataDir, { types: ["card"] })).toEqual([
      {
        type: "card",
        name: "Balance",
        source: "MM",
        qualifier: "Deck of Many Things",
        edition: null,
      },
    ]);
  });

  it("finds nothing for a term no row's name or rendered text holds", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    publishSearchFixture(dataDir, { spells: [FIREBALL], entities: [FIRE_ELEMENTAL] });

    expect(searchCatalog(dataDir, { edition: "classic", term: "nonexistent" })).toEqual([]);
  });
});

describe("listSearchSources", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists each source a searched row of any tier cites once, sorted", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    publishSearchFixture(dataDir, {
      spells: [FIREBALL, GOODBERRY_ONE, { ...FIREBALL, name: "Fire Bolt", level: 0 }],
      entities: [FIRE_ELEMENTAL, { ...FIRE_ELEMENTAL, name: "Azer", source: "TftYP" }],
      lookups: [
        { ...RESTRAINED, source: "XGE" },
        { ...RESTRAINED, kind: "itemType", source: "AI" },
      ],
    });

    expect(listSearchSources(dataDir)).toEqual(["MM", "PHB", "TftYP", "XGE", "XPHB"]);
  });
});

describe("listSearchTypes", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists every Tier A type and each searched lookup kind and entity type, once, sorted", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    publishSearchFixture(dataDir, {
      spells: [FIREBALL],
      entities: [FIRE_ELEMENTAL, GELATINOUS_CUBE, { ...FIRE_ELEMENTAL, type: "hazard" }],
      lookups: [RESTRAINED, { ...RESTRAINED, kind: "itemProperty", name: "R" }],
    });

    expect(listSearchTypes(dataDir)).toEqual([
      "background",
      "class",
      "condition",
      "feat",
      "hazard",
      "item",
      "monster",
      "optfeature",
      "race",
      "spell",
      "subclass",
    ]);
  });
});
