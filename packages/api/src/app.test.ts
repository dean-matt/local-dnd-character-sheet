/**
 * Builds the same route composition `app.ts` does, against a temp pair of databases
 * rather than the real `data/` — `app.ts` itself opens the user's real databases on
 * import, which a test must never touch.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabases } from "./db/client.ts";
import { charactersRoutes } from "./routes/characters.ts";
import { derivedRoutes } from "./routes/derived.ts";
import { featuresRoutes } from "./routes/features.ts";
import { homebrewRoutes } from "./routes/homebrew.ts";
import { pagesRoutes } from "./routes/pages.ts";
import { spellsRoutes } from "./routes/spells.ts";

describe("/openapi.json", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openDatabases>;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "app-openapi-"));
    opened = openDatabases(dataDir);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("documents every character, page, homebrew and spell route", async () => {
    const app = new OpenAPIHono();
    app.route("/", charactersRoutes(opened.charactersDb));
    app.route("/", pagesRoutes(opened.charactersDb));
    app.route("/", derivedRoutes(opened.charactersDb, dataDir, opened.homebrewDb));
    app.route("/", featuresRoutes(opened.charactersDb, dataDir, opened.homebrewDb));
    app.route("/", homebrewRoutes(opened.homebrewDb, opened.charactersDb));
    app.route("/", spellsRoutes(dataDir, opened.homebrewDb));
    app.doc("/openapi.json", { openapi: "3.1.0", info: { title: "t", version: "0" } });

    const res = await app.request("/openapi.json");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Object.keys(body.paths).sort()).toEqual([
      "/characters",
      "/characters/{id}",
      "/characters/{id}/derived",
      "/characters/{id}/features",
      "/characters/{id}/pages",
      "/characters/{id}/pages/restore-defaults",
      "/characters/{id}/state",
      "/homebrew/backgrounds",
      "/homebrew/backgrounds/{id}",
      "/homebrew/classes",
      "/homebrew/classes/{id}",
      "/homebrew/feats",
      "/homebrew/feats/{id}",
      "/homebrew/items",
      "/homebrew/items/{id}",
      "/homebrew/races",
      "/homebrew/races/{id}",
      "/homebrew/spells",
      "/homebrew/spells/{id}",
      "/spells",
      "/spells/{name}/{source}",
    ]);

    const description = body.paths["/spells/{name}/{source}"].get.responses["404"].description;
    expect(description).toBe("No spell with that name and source");
  });

  /**
   * `entries` is recursive — a node's `entries` field can hold more nodes. Without a
   * name to `$ref` back to, the generator expands it forever and the whole document
   * 500s; `packages/catalog/src/entry.ts` names it for exactly this reason.
   */
  it("resolves the recursive entries field to a $ref instead of expanding it forever", async () => {
    const app = new OpenAPIHono();
    app.route("/", homebrewRoutes(opened.homebrewDb, opened.charactersDb));
    app.doc("/openapi.json", { openapi: "3.1.0", info: { title: "t", version: "0" } });

    const res = await app.request("/openapi.json");
    const body = await res.json();
    expect(body.components.schemas.Entries).toBeDefined();

    const itemSchema =
      body.paths["/homebrew/items"].post.requestBody.content["application/json"].schema;
    expect(itemSchema.properties.entries).toEqual({ $ref: "#/components/schemas/Entries" });
  });
});
