import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HomebrewSpellInput } from "@dnd/catalog";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { publishSpells, testDataDir } from "../db/queries/contentFixture.ts";
import { insertHomebrewSpell } from "../db/queries/homebrew.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { spellsRoutes } from "./spells.ts";

const FIREBALL = {
  name: "Fireball",
  source: "PHB",
  edition: "classic",
  level: 3 as const,
  school: "V",
  concentration: 0 as const,
  ritual: 0 as const,
  json: JSON.stringify({
    name: "Fireball",
    source: "PHB",
    level: 3,
    school: "V",
    duration: [{ type: "instant" }],
  }),
};

const GOODBERRY_ONE = {
  name: "Goodberry",
  source: "XPHB",
  edition: "one",
  level: 1,
  school: "C",
  concentration: 0 as const,
  ritual: 0 as const,
  json: JSON.stringify({
    name: "Goodberry",
    source: "XPHB",
    level: 1,
    school: "C",
    duration: [{ type: "instant" }],
  }),
};

const acidSplash = (overrides: Partial<HomebrewSpellInput> = {}): HomebrewSpellInput => ({
  name: "Acid Splash",
  edition: "one",
  level: 0,
  school: "C",
  duration: [{ type: "instant" }],
  ...overrides,
});

describe("spellsRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof spellsRoutes>;

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "spells-routes-"));
    publishSpells(dataDir, [FIREBALL, GOODBERRY_ONE]);
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    opened = openTestDatabases();
    routes = spellsRoutes(dataDir, opened.homebrewDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
  });

  describe("list", () => {
    it("requires an edition", async () => {
      const res = await routes.request("/spells");
      expect(res.status).toBe(400);
    });

    it("returns only spells of the requested edition, with the bound in the body", async () => {
      const res = await routes.request("/spells?edition=classic");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({ total: 1, limit: 50, offset: 0 });
      expect(body.items).toEqual([expect.objectContaining({ name: "Fireball", source: "PHB" })]);
    });

    it("merges a homebrew spell of the same edition into the list, distinguishable by id", async () => {
      insertHomebrewSpell(opened.homebrewDb, "1", acidSplash());

      const res = await routes.request("/spells?edition=one");
      const body = await res.json();

      expect(body.items).toEqual([
        expect.objectContaining({ id: "1", name: "Acid Splash" }),
        expect.objectContaining({ name: "Goodberry", source: "XPHB" }),
      ]);
      expect(body.items[1].id).toBeUndefined();
      expect(body.items[0].source).toBeUndefined();
    });

    it("does not return a homebrew spell of a different edition", async () => {
      insertHomebrewSpell(opened.homebrewDb, "1", acidSplash({ edition: "classic" }));

      const res = await routes.request("/spells?edition=one");
      const body = await res.json();
      expect(body.items).toEqual([expect.objectContaining({ name: "Goodberry" })]);
    });

    it("bounds the page by limit and offset", async () => {
      const res = await routes.request("/spells?edition=classic&limit=1&offset=1");
      const body = await res.json();
      expect(body).toMatchObject({ items: [], total: 1, limit: 1, offset: 1 });
    });
  });

  describe("read", () => {
    it("reads a catalog spell by name and source", async () => {
      const res = await routes.request(`/spells/${encodeURIComponent("Fireball")}/PHB`);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ name: "Fireball", source: "PHB", level: 3 });
    });

    it("404s a name and source no row holds", async () => {
      const res = await routes.request("/spells/Nonexistent/PHB");
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "No spell with that name and source" });
    });

    it("round-trips a name containing a literal slash", async () => {
      const slashDir = testDataDir("spells-routes-slash-");
      routes = spellsRoutes(slashDir, opened.homebrewDb);
      publishSpells(slashDir, [
        FIREBALL,
        {
          ...FIREBALL,
          name: "Antipathy/Sympathy",
          json: JSON.stringify({
            name: "Antipathy/Sympathy",
            source: "PHB",
            level: 8,
            school: "E",
            duration: [{ type: "instant" }],
          }),
        },
      ]);

      const res = await routes.request(`/spells/${encodeURIComponent("Antipathy/Sympathy")}/PHB`);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ name: "Antipathy/Sympathy" });
    });
  });
});
