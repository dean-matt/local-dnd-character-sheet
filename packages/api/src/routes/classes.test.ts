import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { publishClasses } from "../db/queries/contentFixture.ts";
import { classesRoutes } from "./classes.ts";

const CLERIC = {
  name: "Cleric",
  source: "PHB",
  edition: "classic",
  hit_die: 8,
  json: JSON.stringify({ name: "Cleric", source: "PHB" }),
};

const FIGHTER = {
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

const LIFE_DOMAIN = {
  name: "Life Domain",
  source: "PHB",
  short_name: "Life",
  class_name: "Cleric",
  class_source: "PHB",
  edition: "classic",
  json: JSON.stringify({ name: "Life Domain", source: "PHB" }),
};

describe("classesRoutes", () => {
  let dataDir: string;
  let routes: ReturnType<typeof classesRoutes>;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "classes-routes-"));
    publishClasses(dataDir, {
      classes: [CLERIC, FIGHTER, CLERIC_XPHB],
      subclasses: [LIFE_DOMAIN],
      classResources: [
        {
          class_name: "Cleric",
          class_source: "PHB",
          level: 1,
          resource_key: "cantrips_known",
          value: "3",
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
      ],
      classFeatures: [
        {
          name: "Spellcasting",
          source: "PHB",
          class_name: "Cleric",
          class_source: "PHB",
          level: 1,
          edition: "classic",
          json: JSON.stringify({ name: "Spellcasting", source: "PHB" }),
        },
        {
          name: "Divine Domain",
          source: "PHB",
          class_name: "Cleric",
          class_source: "PHB",
          level: 1,
          edition: "classic",
          json: JSON.stringify({ name: "Divine Domain", source: "PHB" }),
        },
      ],
      subclassResources: [
        {
          class_name: "Cleric",
          class_source: "PHB",
          subclass_name: "Life Domain",
          subclass_source: "PHB",
          level: 1,
          resource_key: "bonus_healing",
          value: "2",
        },
      ],
      subclassFeatures: [
        {
          name: "Disciple of Life",
          source: "PHB",
          class_name: "Cleric",
          class_source: "PHB",
          subclass_short_name: "Life",
          subclass_source: "PHB",
          level: 1,
          edition: "classic",
          json: JSON.stringify({ name: "Disciple of Life", source: "PHB" }),
        },
      ],
    });
    routes = classesRoutes(dataDir);
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  describe("list", () => {
    it("requires an edition", async () => {
      const res = await routes.request("/classes");
      expect(res.status).toBe(400);
    });

    it("returns only classes of the requested edition, with the bound in the body", async () => {
      const res = await routes.request("/classes?edition=classic");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({ total: 2, limit: 50, offset: 0 });
      expect(body.items).toEqual([
        expect.objectContaining({ name: "Cleric", source: "PHB" }),
        expect.objectContaining({ name: "Fighter", source: "PHB" }),
      ]);
    });
  });

  describe("read", () => {
    it("reads a class by name and source", async () => {
      const res = await routes.request("/classes/Cleric/PHB");
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ name: "Cleric", source: "PHB", hitDie: 8 });
    });

    it("404s a name and source no row holds", async () => {
      const res = await routes.request("/classes/Nonexistent/PHB");
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "No class with that name and source" });
    });
  });

  describe("what a class grants at a level", () => {
    it("assembles the resources, slots and features two different classes each grant", async () => {
      const cleric = await routes.request("/classes/Cleric/PHB/at/1");
      expect(cleric.status).toBe(200);
      expect(await cleric.json()).toEqual({
        level: 1,
        resources: [{ resourceKey: "cantrips_known", value: "3" }],
        spellSlots: [{ slotLevel: 1, slots: 2 }],
        optionalFeatures: [],
        // Level 1 features order by name: Divine Domain before Spellcasting.
        features: [
          {
            name: "Divine Domain",
            source: "PHB",
            level: 1,
            json: { name: "Divine Domain", source: "PHB" },
          },
          {
            name: "Spellcasting",
            source: "PHB",
            level: 1,
            json: { name: "Spellcasting", source: "PHB" },
          },
        ],
      });

      const fighter = await routes.request("/classes/Fighter/PHB/at/1");
      expect(fighter.status).toBe(200);
      expect(await fighter.json()).toMatchObject({
        resources: [{ resourceKey: "second_wind", value: "1" }],
      });
    });

    it("is a level the class grants nothing at, not a 404", async () => {
      const res = await routes.request("/classes/Cleric/PHB/at/5");
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        level: 5,
        resources: [],
        spellSlots: [],
        optionalFeatures: [],
      });
    });

    it("404s a class no row holds", async () => {
      const res = await routes.request("/classes/Nonexistent/PHB/at/1");
      expect(res.status).toBe(404);
    });

    it("rejects a level outside 1-20", async () => {
      const above = await routes.request("/classes/Cleric/PHB/at/21");
      expect(above.status).toBe(400);

      const below = await routes.request("/classes/Cleric/PHB/at/0");
      expect(below.status).toBe(400);
    });
  });

  describe("subclasses", () => {
    it("lists the subclasses of one class, of one edition", async () => {
      const res = await routes.request("/classes/Cleric/PHB/subclasses?edition=classic");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({ total: 1, limit: 50, offset: 0 });
      expect(body.items).toEqual([
        expect.objectContaining({ name: "Life Domain", className: "Cleric", classSource: "PHB" }),
      ]);
    });

    it("reads a subclass by its own name and source and its class's", async () => {
      const res = await routes.request(
        `/classes/Cleric/PHB/subclasses/${encodeURIComponent("Life Domain")}/PHB`,
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        name: "Life Domain",
        className: "Cleric",
        classSource: "PHB",
      });
    });

    it("404s a subclass whose class key does not match", async () => {
      const res = await routes.request(
        `/classes/Fighter/PHB/subclasses/${encodeURIComponent("Life Domain")}/PHB`,
      );
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        error: "No subclass with that name, source, class name and class source",
      });
    });

    it("assembles what a subclass grants at a level, keyed by its own resources", async () => {
      const res = await routes.request(
        `/classes/Cleric/PHB/subclasses/${encodeURIComponent("Life Domain")}/PHB/at/1`,
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        level: 1,
        resources: [{ resourceKey: "bonus_healing", value: "2" }],
        spellSlots: [],
        optionalFeatures: [],
        features: [
          {
            name: "Disciple of Life",
            source: "PHB",
            level: 1,
            json: { name: "Disciple of Life", source: "PHB" },
          },
        ],
      });
    });

    it("404s a subclass grant read for a subclass no row holds", async () => {
      const res = await routes.request("/classes/Cleric/PHB/subclasses/Nonexistent/PHB/at/1");
      expect(res.status).toBe(404);
    });
  });
});
