import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { publishFeats } from "../db/queries/contentFixture.ts";
import { featsRoutes } from "./feats.ts";

const ALERT = {
  name: "Alert",
  source: "PHB",
  edition: "classic",
  json: JSON.stringify({ name: "Alert", source: "PHB" }),
};

const TELEKINETIC_ONE = {
  name: "Telekinetic",
  source: "XPHB",
  edition: "one",
  json: JSON.stringify({ name: "Telekinetic", source: "XPHB" }),
};

describe("featsRoutes", () => {
  let dataDir: string;
  let routes: ReturnType<typeof featsRoutes>;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "feats-routes-"));
    publishFeats(dataDir, [ALERT, TELEKINETIC_ONE]);
    routes = featsRoutes(dataDir);
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  describe("list", () => {
    it("requires an edition", async () => {
      const res = await routes.request("/feats");
      expect(res.status).toBe(400);
    });

    it("returns only feats of the requested edition, with the bound in the body", async () => {
      const res = await routes.request("/feats?edition=classic");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({ total: 1, limit: 50, offset: 0 });
      expect(body.items).toEqual([expect.objectContaining({ name: "Alert", source: "PHB" })]);
    });

    it("bounds the page by limit and offset", async () => {
      const res = await routes.request("/feats?edition=classic&limit=1&offset=1");
      const body = await res.json();
      expect(body).toMatchObject({ items: [], total: 1, limit: 1, offset: 1 });
    });
  });

  describe("read", () => {
    it("reads a feat by name and source", async () => {
      const res = await routes.request("/feats/Alert/PHB");
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ name: "Alert", source: "PHB" });
    });

    it("404s a name and source no row holds", async () => {
      const res = await routes.request("/feats/Nonexistent/PHB");
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "No feat with that name and source" });
    });
  });
});
