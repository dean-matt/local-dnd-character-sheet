import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabases } from "../db/client.ts";
import { publishSearchFixture } from "../db/queries/contentFixture.ts";
import { insertHomebrewItem, insertHomebrewSpell } from "../db/queries/homebrew.ts";
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

describe("searchRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openDatabases>;
  let routes: ReturnType<typeof searchRoutes>;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "search-routes-"));
    publishSearchFixture(dataDir, { spells: [FIREBALL], entities: [FIRE_ELEMENTAL] });
    opened = openDatabases(dataDir);
    routes = searchRoutes(dataDir, opened.homebrewDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("requires an edition and a term", async () => {
    expect((await routes.request("/search?q=fire")).status).toBe(400);
    expect((await routes.request("/search?edition=classic")).status).toBe(400);
  });

  it("returns a Tier A hit, a Tier C hit and a homebrew hit for one term, in one list", async () => {
    insertHomebrewItem(opened.homebrewDb, "1", {
      name: "Firebrand Axe",
      edition: "classic",
      type: "M",
    });

    const res = await routes.request("/search?edition=classic&q=fire");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({ total: 3, limit: 50, offset: 0 });
    expect(body.items).toEqual([
      { type: "monster", name: "Fire Elemental", source: "MM", edition: null },
      { type: "spell", name: "Fireball", source: "PHB", edition: "classic" },
      { type: "item", id: "1", name: "Firebrand Axe", edition: "classic" },
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
      { type: "spell", id: "1", name: "Fire Shield", edition: "classic" },
      { type: "spell", name: "Fireball", source: "PHB", edition: "classic" },
    ]);
  });

  it("bounds the page by limit and offset", async () => {
    const res = await routes.request("/search?edition=classic&q=fire&limit=1&offset=1");
    const body = await res.json();

    expect(body).toMatchObject({ total: 2, limit: 1, offset: 1 });
    expect(body.items).toEqual([
      { type: "spell", name: "Fireball", source: "PHB", edition: "classic" },
    ]);
  });
});
