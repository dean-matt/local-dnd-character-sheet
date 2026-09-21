import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HomebrewItemInput } from "@dnd/catalog";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabases } from "../db/client.ts";
import { publishItems } from "../db/queries/contentFixture.ts";
import { insertHomebrewItem } from "../db/queries/homebrew.ts";
import { itemsRoutes } from "./items.ts";

const LONGSWORD = {
  name: "Longsword",
  source: "PHB",
  edition: "classic",
  kind: "baseitem",
  type: "M",
  rarity: null,
  requires_attunement: 0 as const,
  json: JSON.stringify({ name: "Longsword", source: "PHB" }),
};

const DEMON_ARMOR_ONE = {
  name: "Demon Armor",
  source: "XDMG",
  edition: "one",
  kind: "item",
  type: "HA",
  rarity: "very rare",
  requires_attunement: 1 as const,
  json: JSON.stringify({ name: "Demon Armor", source: "XDMG" }),
};

const BAG_OF_TRICKS = {
  name: "Bag of Tricks",
  source: "DMG",
  edition: "classic",
  kind: "itemGroup",
  type: null,
  rarity: "uncommon",
  requires_attunement: 0 as const,
  json: JSON.stringify({ name: "Bag of Tricks", source: "DMG" }),
};

const sunblade = (overrides: Partial<HomebrewItemInput> = {}): HomebrewItemInput => ({
  name: "Sunblade",
  edition: "one",
  ...overrides,
});

describe("itemsRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openDatabases>;
  let routes: ReturnType<typeof itemsRoutes>;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "items-routes-"));
    publishItems(dataDir, [LONGSWORD, DEMON_ARMOR_ONE, BAG_OF_TRICKS]);
    opened = openDatabases(dataDir);
    routes = itemsRoutes(dataDir, opened.homebrewDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  describe("list", () => {
    it("requires an edition", async () => {
      const res = await routes.request("/items");
      expect(res.status).toBe(400);
    });

    it("returns only item and baseitem kinds of the requested edition", async () => {
      const res = await routes.request("/items?edition=classic");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({ total: 1, limit: 50, offset: 0 });
      expect(body.items).toEqual([expect.objectContaining({ name: "Longsword", source: "PHB" })]);
    });

    it("merges a homebrew item of the same edition into the list, distinguishable by id", async () => {
      insertHomebrewItem(opened.homebrewDb, "1", sunblade());

      const res = await routes.request("/items?edition=one");
      const body = await res.json();

      expect(body.items).toEqual([
        expect.objectContaining({ name: "Demon Armor", source: "XDMG" }),
        expect.objectContaining({ id: "1", name: "Sunblade" }),
      ]);
      expect(body.items[0].id).toBeUndefined();
      expect(body.items[1].source).toBeUndefined();
    });

    it("does not return a homebrew item of a different edition", async () => {
      insertHomebrewItem(opened.homebrewDb, "1", sunblade({ edition: "classic" }));

      const res = await routes.request("/items?edition=one");
      const body = await res.json();
      expect(body.items).toEqual([expect.objectContaining({ name: "Demon Armor" })]);
    });
  });

  describe("read", () => {
    it("reads a catalog item by name and source", async () => {
      const res = await routes.request(`/items/${encodeURIComponent("Longsword")}/PHB`);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        name: "Longsword",
        source: "PHB",
        kind: "baseitem",
      });
    });

    it("404s a name and source no row holds", async () => {
      const res = await routes.request("/items/Nonexistent/PHB");
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "No item with that name and source" });
    });
  });
});
