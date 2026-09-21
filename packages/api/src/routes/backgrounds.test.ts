import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { publishBackgrounds } from "../db/queries/contentFixture.ts";
import { backgroundsRoutes } from "./backgrounds.ts";

const ACOLYTE = {
  name: "Acolyte",
  source: "PHB",
  edition: "classic",
  json: JSON.stringify({ name: "Acolyte", source: "PHB" }),
};

const FEYLOST_ONE = {
  name: "Feylost",
  source: "XPHB",
  edition: "one",
  json: JSON.stringify({ name: "Feylost", source: "XPHB" }),
};

describe("backgroundsRoutes", () => {
  let dataDir: string;
  let routes: ReturnType<typeof backgroundsRoutes>;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "backgrounds-routes-"));
    publishBackgrounds(dataDir, [ACOLYTE, FEYLOST_ONE]);
    routes = backgroundsRoutes(dataDir);
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  describe("list", () => {
    it("requires an edition", async () => {
      const res = await routes.request("/backgrounds");
      expect(res.status).toBe(400);
    });

    it("returns only backgrounds of the requested edition, with the bound in the body", async () => {
      const res = await routes.request("/backgrounds?edition=classic");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({ total: 1, limit: 50, offset: 0 });
      expect(body.items).toEqual([expect.objectContaining({ name: "Acolyte", source: "PHB" })]);
    });

    it("bounds the page by limit and offset", async () => {
      const res = await routes.request("/backgrounds?edition=classic&limit=1&offset=1");
      const body = await res.json();
      expect(body).toMatchObject({ items: [], total: 1, limit: 1, offset: 1 });
    });
  });

  describe("read", () => {
    it("reads a background by name and source", async () => {
      const res = await routes.request("/backgrounds/Acolyte/PHB");
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ name: "Acolyte", source: "PHB" });
    });

    it("404s a name and source no row holds", async () => {
      const res = await routes.request("/backgrounds/Nonexistent/PHB");
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "No background with that name and source" });
    });
  });
});
