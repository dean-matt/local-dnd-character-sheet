import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { publishMeta } from "../db/queries/contentFixture.ts";
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
});
