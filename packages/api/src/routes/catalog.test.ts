import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SCHEMA_STAMP } from "@dnd/content/schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { publishMeta, publishSearchFixture } from "../db/queries/contentFixture.ts";
import { catalogRoutes } from "./catalog.ts";

describe("catalogRoutes", () => {
  let dataDir: string;
  let routes: ReturnType<typeof catalogRoutes>;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "catalog-routes-"));
    routes = catalogRoutes(dataDir);
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("returns the catalog's meta rows once one has been built", async () => {
    publishMeta(dataDir, [
      { key: "upstream_tag", value: "v2.34.1" },
      { key: "built_at", value: "2026-01-01T00:00:00.000Z" },
    ]);

    const res = await routes.request("/catalog/meta");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      meta: [
        { key: "built_at", value: "2026-01-01T00:00:00.000Z" },
        SCHEMA_STAMP,
        { key: "upstream_tag", value: "v2.34.1" },
      ],
    });
  });

  it("states plainly that no catalog has been built, rather than crashing or answering empty", async () => {
    const res = await routes.request("/catalog/meta");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "No catalog has been built yet — run `pnpm content:build`.",
    });
  });

  it("titles and groups each source the catalog's books and adventures name", async () => {
    publishSearchFixture(dataDir, {
      entities: [
        {
          type: "book",
          name: "Player's Handbook (2024)",
          source: "XPHB",
          qualifier: "",
          edition: "one",
          json: JSON.stringify({ group: "core" }),
          rendered_text: "",
        },
      ],
    });

    const res = await routes.request("/catalog/sources");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      sources: [{ source: "XPHB", name: "Player's Handbook (2024)", group: "core" }],
    });
  });

  it("answers the sources with the same 503 as the meta before any build", async () => {
    const res = await routes.request("/catalog/sources");
    expect(res.status).toBe(503);
  });

  describe("a row by type", () => {
    const json = (name: string) => JSON.stringify({ name, entries: [`${name}.`] });

    beforeEach(() => {
      publishSearchFixture(dataDir, {
        optionalFeatures: [
          { name: "Agonizing Blast", source: "PHB", edition: "classic", json: json("Agonizing") },
        ],
        lookups: [
          {
            kind: "condition",
            name: "Restrained",
            source: "XPHB",
            edition: "one",
            json: json("R"),
          },
          {
            kind: "deity",
            name: "Moradin",
            source: "PHB",
            qualifier: "Dwarven",
            edition: null,
            json: json("Moradin"),
          },
        ],
        entities: [
          {
            type: "trap",
            name: "Falling Net",
            source: "DMG",
            qualifier: "",
            edition: null,
            json: json("Net"),
            rendered_text: "",
          },
        ],
      });
    });

    it.each([
      ["optfeature", "Agonizing%20Blast/PHB", "Agonizing Blast", "classic"],
      ["condition", "Restrained/XPHB", "Restrained", "one"],
      ["trap", "Falling%20Net/DMG", "Falling Net", null],
    ])("reads a %s row by its key", async (type, key, name, edition) => {
      const res = await routes.request(`/catalog/${type}/${key}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ type, name, edition });
    });

    it("reads a deity by its pantheon, and finds none without it", async () => {
      const res = await routes.request("/catalog/deity/Moradin/PHB?qualifier=Dwarven");
      expect(await res.json()).toEqual({
        type: "deity",
        name: "Moradin",
        source: "PHB",
        qualifier: "Dwarven",
        edition: null,
        json: { name: "Moradin", entries: ["Moradin."] },
      });
      expect((await routes.request("/catalog/deity/Moradin/PHB")).status).toBe(404);
    });

    it.each(["condition/Restrained/PHB", "trap/Restrained/XPHB", "spell/Fireball/PHB"])(
      "answers 404 for %s, a key no type it reads holds",
      async (address) => {
        const res = await routes.request(`/catalog/${address}`);
        expect(res.status).toBe(404);
      },
    );
  });
});
