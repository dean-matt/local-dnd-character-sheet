import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabases } from "../db/client.ts";
import { homebrewRoutes } from "./homebrew.ts";

const sunblade = (overrides: Record<string, unknown> = {}) => ({
  name: "Sunblade",
  edition: "one",
  type: "M",
  rarity: "rare",
  ...overrides,
});

const acidSplash = (overrides: Record<string, unknown> = {}) => ({
  name: "Acid Splash",
  edition: "one",
  level: 0,
  school: "C",
  duration: [{ type: "instant" }],
  ...overrides,
});

const json = (body: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

describe("homebrewRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openDatabases>;
  let routes: ReturnType<typeof homebrewRoutes>;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "homebrew-routes-"));
    opened = openDatabases(dataDir);
    routes = homebrewRoutes(opened.homebrewDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  describe("items", () => {
    it("lists no items before any are created", async () => {
      const res = await routes.request("/homebrew/items");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("creates an item, stamping source and generating an id", async () => {
      const res = await routes.request("/homebrew/items", json({ ...sunblade(), source: "PHB" }));
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(typeof body.id).toBe("string");
      expect(body.json.source).toBe("HB");
      expect(body).toMatchObject({ name: "Sunblade", edition: "one", requiresAttunement: false });
    });

    it("rejects an item missing a required field, naming which one failed", async () => {
      const res = await routes.request("/homebrew/items", json({ edition: "one" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      const issues = JSON.parse(body.error.message);
      expect(issues).toContainEqual(expect.objectContaining({ path: ["name"] }));
    });

    it("reads an item it just created", async () => {
      const created = await (await routes.request("/homebrew/items", json(sunblade()))).json();

      const res = await routes.request(`/homebrew/items/${created.id}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(created);
    });

    it("404s reading, updating or deleting an id that does not exist", async () => {
      expect((await routes.request("/homebrew/items/missing")).status).toBe(404);

      const putRes = await routes.request("/homebrew/items/missing", {
        ...json(sunblade()),
        method: "PUT",
      });
      expect(putRes.status).toBe(404);

      expect((await routes.request("/homebrew/items/missing", { method: "DELETE" })).status).toBe(
        404,
      );
    });

    it("renames an item, keeping its id", async () => {
      const created = await (await routes.request("/homebrew/items", json(sunblade()))).json();

      const res = await routes.request(`/homebrew/items/${created.id}`, {
        ...json(sunblade({ name: "Sunblade+1" })),
        method: "PUT",
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ id: created.id, name: "Sunblade+1" });
    });

    it("deletes an item, after which it 404s", async () => {
      const created = await (await routes.request("/homebrew/items", json(sunblade()))).json();

      expect(
        (await routes.request(`/homebrew/items/${created.id}`, { method: "DELETE" })).status,
      ).toBe(204);
      expect((await routes.request(`/homebrew/items/${created.id}`)).status).toBe(404);
    });
  });

  describe("spells", () => {
    it("creates a spell, stamping source and generating an id", async () => {
      const res = await routes.request(
        "/homebrew/spells",
        json({ ...acidSplash(), source: "PHB" }),
      );
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(typeof body.id).toBe("string");
      expect(body.json.source).toBe("HB");
      expect(body).toMatchObject({ name: "Acid Splash", level: 0, school: "C" });
    });

    it("reads a spell it just created", async () => {
      const created = await (await routes.request("/homebrew/spells", json(acidSplash()))).json();

      const res = await routes.request(`/homebrew/spells/${created.id}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(created);
    });

    it("404s reading, updating or deleting an id that does not exist", async () => {
      expect((await routes.request("/homebrew/spells/missing")).status).toBe(404);

      const putRes = await routes.request("/homebrew/spells/missing", {
        ...json(acidSplash()),
        method: "PUT",
      });
      expect(putRes.status).toBe(404);

      expect((await routes.request("/homebrew/spells/missing", { method: "DELETE" })).status).toBe(
        404,
      );
    });

    it("deletes a spell, after which it 404s", async () => {
      const created = await (await routes.request("/homebrew/spells", json(acidSplash()))).json();

      expect(
        (await routes.request(`/homebrew/spells/${created.id}`, { method: "DELETE" })).status,
      ).toBe(204);
      expect((await routes.request(`/homebrew/spells/${created.id}`)).status).toBe(404);
    });
  });
});
