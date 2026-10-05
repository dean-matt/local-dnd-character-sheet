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

  it("lists each source a Tier A or Tier C row cites once, sorted", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    publishSearchFixture(dataDir, {
      spells: [FIREBALL, GOODBERRY_ONE, { ...FIREBALL, name: "Fire Bolt", level: 0 }],
      entities: [FIRE_ELEMENTAL, { ...FIRE_ELEMENTAL, name: "Azer", source: "TftYP" }],
    });

    expect(listSearchSources(dataDir)).toEqual(["MM", "PHB", "TftYP", "XPHB"]);
  });
});

describe("listSearchTypes", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists every Tier A type and each type an entity carries, once, sorted", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-search-"));
    publishSearchFixture(dataDir, {
      spells: [FIREBALL],
      entities: [FIRE_ELEMENTAL, GELATINOUS_CUBE, { ...FIRE_ELEMENTAL, type: "hazard" }],
    });

    expect(listSearchTypes(dataDir)).toEqual([
      "background",
      "class",
      "feat",
      "hazard",
      "item",
      "monster",
      "optfeature",
      "race",
      "spell",
    ]);
  });
});
