import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listSearchSources, searchCatalog } from "./catalog-search.ts";
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
