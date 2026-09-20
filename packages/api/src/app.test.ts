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
import { homebrewRoutes } from "./routes/homebrew.ts";

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

  it("documents every character and homebrew route", async () => {
    const app = new OpenAPIHono();
    app.route("/", charactersRoutes(opened.charactersDb));
    app.route("/", homebrewRoutes(opened.homebrewDb));
    app.doc("/openapi.json", { openapi: "3.1.0", info: { title: "t", version: "0" } });

    const res = await app.request("/openapi.json");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Object.keys(body.paths).sort()).toEqual([
      "/characters",
      "/characters/{id}",
      "/characters/{id}/state",
      "/homebrew/items",
      "/homebrew/items/{id}",
      "/homebrew/spells",
      "/homebrew/spells/{id}",
    ]);
  });

  /**
   * `entries` is recursive — a node's `entries` field can hold more nodes. Without a
   * name to `$ref` back to, the generator expands it forever and the whole document
   * 500s; `packages/catalog/src/entry.ts` names it for exactly this reason.
   */
  it("resolves the recursive entries field to a $ref instead of expanding it forever", async () => {
    const app = new OpenAPIHono();
    app.route("/", homebrewRoutes(opened.homebrewDb));
    app.doc("/openapi.json", { openapi: "3.1.0", info: { title: "t", version: "0" } });

    const res = await app.request("/openapi.json");
    const body = await res.json();
    expect(body.components.schemas.Entries).toBeDefined();

    const itemSchema =
      body.paths["/homebrew/items"].post.requestBody.content["application/json"].schema;
    expect(itemSchema.properties.entries).toEqual({ $ref: "#/components/schemas/Entries" });
  });
});
