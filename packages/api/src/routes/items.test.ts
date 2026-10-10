import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HomebrewItemInput } from "@dnd/catalog";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { publishItems } from "../db/queries/contentFixture.ts";
import { insertHomebrewItem } from "../db/queries/homebrew.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { itemsRoutes } from "./items.ts";

const LONGSWORD = {
  name: "Longsword",
  source: "PHB",
  edition: "classic",
  kind: "baseitem",
  type: "M",
  rarity: null,
  requires_attunement: 0 as const,
  json: JSON.stringify({ name: "Longsword", source: "PHB", weapon: true }),
};

const NET = {
  name: "Net",
  source: "PHB",
  edition: "classic",
  kind: "baseitem",
  type: "NET",
  rarity: null,
  requires_attunement: 0 as const,
  json: JSON.stringify({ name: "Net", source: "PHB", weapon: true, net: true }),
};

const PLUS_ONE_WEAPON = {
  name: "+1 Weapon",
  source: "DMG",
  edition: "classic",
  kind: "magicvariant",
  type: null,
  rarity: "uncommon",
  requires_attunement: 0 as const,
  json: JSON.stringify({
    name: "+1 Weapon",
    requires: [{ weapon: true }],
    excludes: { net: true },
    inherits: { namePrefix: "+1 ", source: "DMG", rarity: "uncommon" },
  }),
};

const ADAMANTINE_WEAPON = {
  name: "Adamantine Weapon",
  source: "DMG",
  edition: "classic",
  kind: "magicvariant",
  type: null,
  rarity: "uncommon",
  requires_attunement: 0 as const,
  json: JSON.stringify({
    name: "Adamantine Weapon",
    requires: [{ weapon: true }],
    excludes: { net: true },
    inherits: {
      namePrefix: "Adamantine ",
      source: "DMG",
      rarity: "uncommon",
      valueExpression: "[[baseItem.value]] + 50000",
    },
  }),
};

const REVOLVER = {
  name: "Revolver",
  source: "DMG",
  edition: "classic",
  kind: "baseitem",
  type: "FIRE",
  rarity: null,
  requires_attunement: 0 as const,
  json: JSON.stringify({ name: "Revolver", source: "DMG", weapon: true }),
};

const armor = (name: string, type: string) => ({
  name,
  source: "DMG",
  edition: "classic",
  kind: "baseitem",
  type,
  rarity: null,
  requires_attunement: 0 as const,
  json: JSON.stringify({ name, source: "DMG", type, armor: true }),
});

const MIND_CARAPACE = {
  name: "Mind Carapace",
  source: "VGM",
  edition: "classic",
  kind: "magicvariant",
  type: null,
  rarity: "uncommon",
  requires_attunement: 0 as const,
  json: JSON.stringify({
    name: "Mind Carapace",
    requires: [{ type: "HA" }],
    inherits: { nameSuffix: " of Mind Carapace", source: "VGM", rarity: "uncommon" },
  }),
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
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof itemsRoutes>;

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "items-routes-"));
    publishItems(dataDir, [LONGSWORD, DEMON_ARMOR_ONE, BAG_OF_TRICKS]);
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    opened = openTestDatabases();
    routes = itemsRoutes(dataDir, opened.homebrewDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
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

  describe("expand", () => {
    let variantDataDir: string;
    let variantRoutes: ReturnType<typeof itemsRoutes>;

    beforeAll(() => {
      variantDataDir = mkdtempSync(join(tmpdir(), "items-routes-variants-"));
      publishItems(variantDataDir, [
        LONGSWORD,
        NET,
        PLUS_ONE_WEAPON,
        ADAMANTINE_WEAPON,
        REVOLVER,
        armor("Half Plate", "MA"),
        armor("Plate", "HA"),
        MIND_CARAPACE,
      ]);
    });

    afterAll(() => {
      rmSync(variantDataDir, { recursive: true, force: true });
    });

    beforeEach(() => {
      variantRoutes = itemsRoutes(variantDataDir, opened.homebrewDb);
    });

    it("expands a base item and a magic variant into the specific item they make", async () => {
      const res = await variantRoutes.request("/items/Longsword/PHB/variants/%2B1%20Weapon/DMG");
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        name: "+1 Longsword",
        source: "DMG",
        kind: "item",
        rarity: "uncommon",
      });
    });

    it("reads a magic variant on its own, as the item its template describes", async () => {
      const res = await variantRoutes.request("/items/%2B1%20Weapon/DMG");
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        name: "+1 Weapon",
        source: "DMG",
        kind: "magicvariant",
        json: { name: "+1 Weapon", source: "DMG", rarity: "uncommon" },
      });
    });

    it("404s a base item or a variant no row holds", async () => {
      const res = await variantRoutes.request("/items/Nonexistent/PHB/variants/%2B1%20Weapon/DMG");
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        error: "No base item or magic variant with that name and source",
      });
    });

    it("409s a base item the variant's requires or excludes refuses", async () => {
      const res = await variantRoutes.request("/items/Net/PHB/variants/%2B1%20Weapon/DMG");
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({
        error: "This base item does not meet the variant's requirements",
      });
    });

    it("expands a refused pair only when the caller asks to override it", async () => {
      const path = "/items/Half%20Plate/DMG/variants/Mind%20Carapace/VGM";
      expect((await variantRoutes.request(path)).status).toBe(409);
      expect((await variantRoutes.request(`${path}?override=false`)).status).toBe(409);
      const res = await variantRoutes.request(`${path}?override=true`);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ name: "Half Plate of Mind Carapace" });
    });

    it("keeps a weapon variant off armor even when asked to override", async () => {
      const res = await variantRoutes.request(
        "/items/Half%20Plate/DMG/variants/%2B1%20Weapon/DMG?override=true",
      );
      expect(res.status).toBe(409);
    });

    it("expands a base item with no value into an item with none, rather than crashing", async () => {
      const res = await variantRoutes.request(
        "/items/Revolver/DMG/variants/Adamantine%20Weapon/DMG",
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("Adamantine Revolver");
      expect(body.json.value).toBeUndefined();
    });

    it("404s, not 500s, where the base and variant path segments are swapped", async () => {
      const res = await variantRoutes.request("/items/%2B1%20Weapon/DMG/variants/Longsword/PHB");
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        error: "No base item or magic variant with that name and source",
      });
    });
  });
});
