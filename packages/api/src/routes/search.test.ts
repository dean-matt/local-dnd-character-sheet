import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { publishSearchFixture } from "../db/queries/contentFixture.ts";
import { insertHomebrewItem, insertHomebrewSpell } from "../db/queries/homebrew.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { searchRoutes } from "./search.ts";

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

const FIRE_ELEMENTAL = {
  type: "monster",
  name: "Fire Elemental",
  source: "MM",
  qualifier: "",
  edition: null,
  json: JSON.stringify({ name: "Fire Elemental", source: "MM" }),
  rendered_text: "Fire Elemental. A fire elemental is a mass of elemental fire.",
};

const AZER = {
  type: "monster",
  name: "Azer",
  source: "MM",
  qualifier: "",
  edition: null,
  json: JSON.stringify({ name: "Azer", source: "MM" }),
  rendered_text: "Azer. Its hair is a mane of fire.",
};

describe("searchRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof searchRoutes>;

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "search-routes-"));
    publishSearchFixture(dataDir, { spells: [FIREBALL], entities: [FIRE_ELEMENTAL, AZER] });
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    opened = openTestDatabases();
    routes = searchRoutes(dataDir, opened.homebrewDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
  });

  it("rejects an unknown edition and a spell level past 9", async () => {
    expect((await routes.request("/search?edition=third&q=fire")).status).toBe(400);
    expect((await routes.request("/search?q=fire&maxLevel=10")).status).toBe(400);
  });

  it("returns Tier A, Tier C and homebrew hits in one list, a text-only match after every name match", async () => {
    insertHomebrewItem(opened.homebrewDb, "1", {
      name: "Firebrand Axe",
      edition: "classic",
      type: "M",
    });

    const res = await routes.request("/search?edition=classic&q=fire");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({ total: 4, limit: 50, offset: 0 });
    expect(body.items).toEqual([
      { type: "spell", name: "Fireball", source: "PHB", edition: "classic" },
      { type: "item", id: "1", name: "Firebrand Axe", edition: "classic" },
      { type: "monster", name: "Fire Elemental", source: "MM", edition: null },
      { type: "monster", name: "Azer", source: "MM", edition: null },
    ]);
  });

  it("narrows to one type across catalog, entities and homebrew", async () => {
    insertHomebrewSpell(opened.homebrewDb, "1", {
      name: "Fire Shield",
      edition: "classic",
      level: 4,
      school: "V",
      duration: [{ type: "instant" }],
    });

    const res = await routes.request("/search?edition=classic&q=fire&type=spell");
    const body = await res.json();

    expect(body.items).toEqual([
      { type: "spell", name: "Fireball", source: "PHB", edition: "classic" },
      { type: "spell", id: "1", name: "Fire Shield", edition: "classic" },
    ]);
  });

  it("bounds the page by limit and offset", async () => {
    const res = await routes.request("/search?edition=classic&q=fire&limit=1&offset=1");
    const body = await res.json();

    expect(body).toMatchObject({ total: 3, limit: 1, offset: 1 });
    expect(body.items).toEqual([
      { type: "monster", name: "Fire Elemental", source: "MM", edition: null },
    ]);
  });

  it("leaves out each excluded source's catalog rows before paging, and keeps homebrew", async () => {
    insertHomebrewItem(opened.homebrewDb, "1", {
      name: "Firebrand Axe",
      edition: "classic",
      type: "M",
    });

    const res = await routes.request(
      "/search?edition=classic&q=fire&exclude=MM,DMG&limit=1&offset=1",
    );
    const body = await res.json();

    expect(body).toMatchObject({ total: 2, limit: 1, offset: 1 });
    expect(body.items).toEqual([
      { type: "item", id: "1", name: "Firebrand Axe", edition: "classic" },
    ]);
  });

  it("lists every row of a type, alphabetically, for a blank query", async () => {
    const res = await routes.request("/search?edition=classic&type=monster");
    const body = await res.json();

    expect(body.items.map((hit: { name: string }) => hit.name)).toEqual(["Azer", "Fire Elemental"]);
  });

  it("reads both editions where none is named, and narrows to several types", async () => {
    insertHomebrewSpell(opened.homebrewDb, "1", {
      name: "Fire Shield",
      edition: "one",
      level: 4,
      school: "V",
      duration: [{ type: "instant" }],
    });

    const res = await routes.request("/search?q=fire&type=spell,item");
    const body = await res.json();

    expect(body.items).toEqual([
      { type: "spell", name: "Fireball", source: "PHB", edition: "classic" },
      { type: "spell", id: "1", name: "Fire Shield", edition: "one" },
    ]);
  });

  it("narrows spells, homebrew among them, by level and school", async () => {
    insertHomebrewSpell(opened.homebrewDb, "1", {
      name: "Fire Shield",
      edition: "classic",
      level: 4,
      school: "A",
      duration: [{ type: "instant" }],
    });
    const names = async (query: string) =>
      (await (await routes.request(`/search?edition=classic&q=fire&${query}`)).json()).items.map(
        (hit: { name: string }) => hit.name,
      );

    expect(await names("minLevel=4")).toEqual(["Fire Shield", "Fire Elemental", "Azer"]);
    expect(await names("school=V&type=spell")).toEqual(["Fireball"]);
  });

  it("narrows items, homebrew among them, by rarity", async () => {
    insertHomebrewItem(opened.homebrewDb, "1", {
      name: "Firebrand Axe",
      edition: "classic",
      type: "M",
      rarity: "rare",
    });
    insertHomebrewItem(opened.homebrewDb, "2", {
      name: "Fire Poker",
      edition: "classic",
      type: "M",
      rarity: "common",
    });

    const res = await routes.request("/search?edition=classic&q=fire&type=item&rarity=rare");
    const body = await res.json();

    expect(body.items).toEqual([
      { type: "item", id: "1", name: "Firebrand Axe", edition: "classic" },
    ]);
  });

  it("narrows to the named sources and leaves homebrew out", async () => {
    insertHomebrewItem(opened.homebrewDb, "1", {
      name: "Firebrand Axe",
      edition: "classic",
      type: "M",
    });

    const res = await routes.request("/search?edition=classic&q=fire&source=PHB");
    const body = await res.json();

    expect(body.items).toEqual([
      { type: "spell", name: "Fireball", source: "PHB", edition: "classic" },
    ]);
  });

  it("lists every type a search can return", async () => {
    const res = await routes.request("/search/types");

    expect(res.status).toBe(200);
    expect((await res.json()).types).toContain("monster");
  });

  it("lists every source a search can return", async () => {
    const res = await routes.request("/search/sources");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sources: ["MM", "PHB"] });
  });
});
