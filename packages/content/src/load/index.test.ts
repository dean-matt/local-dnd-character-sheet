import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildContent } from "../build-db.ts";
import { LOADERS } from "./index.ts";

const FIXTURE_VENDOR = join(import.meta.dirname, "../../../../tests/fixtures/5etools");

/**
 * Fences the registry as a whole against the committed fixture subset — the only
 * 5etools data CI has, since `vendor/` is never committed. Every loader test
 * passes its own loader in isolation, so this is where a loader whose fixture is
 * missing fails, and the only place the real registry's insert order runs.
 */
describe("LOADERS", () => {
  let workspace: string;
  let dbPath: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "content-registry-"));
    dbPath = join(workspace, "data", "content.db");
  });

  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  it("builds from tests/fixtures with rows in every table it writes", () => {
    const counts = buildContent({
      vendorDir: FIXTURE_VENDOR,
      dbPath,
      loaders: LOADERS,
      meta: { upstream_tag: "fixtures" },
    });

    expect(Object.keys(counts).length).toBeGreaterThan(0);
    for (const [table, rows] of Object.entries(counts)) {
      expect(
        rows,
        `${table} is empty — a loader read the fixtures and wrote nothing`,
      ).toBeGreaterThan(0);
    }
  });
});
