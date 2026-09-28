import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { publishRaces, publishSubraces } from "../db/queries/contentFixture.ts";
import { racesRoutes } from "./races.ts";

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

const HIGH_ELF = {
  name: "High",
  source: "PHB",
  race_name: "Elf",
  race_source: "PHB",
  edition: "classic",
  json: JSON.stringify({ name: "High", source: "PHB" }),
};

describe("racesRoutes", () => {
  let dataDir: string;
  let routes: ReturnType<typeof racesRoutes>;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "races-routes-"));
    publishRaces(dataDir, [ELF, TIEFLING_ONE]);
    routes = racesRoutes(dataDir);
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  describe("list", () => {
    it("requires an edition", async () => {
      const res = await routes.request("/races");
      expect(res.status).toBe(400);
    });

    it("returns only races of the requested edition, with the bound in the body", async () => {
      const res = await routes.request("/races?edition=classic");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({ total: 1, limit: 50, offset: 0 });
      expect(body.items).toEqual([expect.objectContaining({ name: "Elf", source: "PHB" })]);
    });
  });

  describe("read", () => {
    it("reads a race by name and source", async () => {
      const res = await routes.request("/races/Elf/PHB");
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ name: "Elf", source: "PHB" });
    });

    it("404s a name and source no row holds", async () => {
      const res = await routes.request("/races/Nonexistent/PHB");
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "No race with that name and source" });
    });
  });

  describe("subraces", () => {
    beforeEach(() => {
      publishSubraces(dataDir, [HIGH_ELF]);
    });

    it("lists the subraces of one race, of one edition", async () => {
      const res = await routes.request("/races/Elf/PHB/subraces?edition=classic");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({ total: 1, limit: 50, offset: 0 });
      expect(body.items).toEqual([
        expect.objectContaining({ name: "High", raceName: "Elf", raceSource: "PHB" }),
      ]);
    });

    it("reads a subrace by its own name and source and its race's", async () => {
      const res = await routes.request("/races/Elf/PHB/subraces/High/PHB");
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        name: "High",
        raceName: "Elf",
        raceSource: "PHB",
      });
    });

    it("404s a subrace whose race key does not match", async () => {
      const res = await routes.request("/races/Gnome/PHB/subraces/High/PHB");
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        error: "No subrace with that name, source, race name and race source",
      });
    });
  });
});
