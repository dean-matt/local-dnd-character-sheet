import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { publishMeta } from "../db/queries/contentFixture.ts";
import { healthRoutes } from "./health.ts";

describe("healthRoutes", () => {
  let dataDir: string;
  let routes: ReturnType<typeof healthRoutes>;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "health-routes-"));
    routes = healthRoutes(dataDir);
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("reports the catalog's upstream tag as its version", async () => {
    publishMeta(dataDir, [{ key: "upstream_tag", value: "v2.34.1" }]);

    const res = await routes.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", version: "v2.34.1" });
  });

  it("reports a null version rather than crashing when no catalog has been built", async () => {
    const res = await routes.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", version: null });
  });
});
