import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
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

  /**
   * The three tables holding an entitlement are written by two loaders, so this
   * is the only place their sum can be asserted. The pool is unfiltered by
   * edition on purpose: a 2024 Battle Master who took a 2014 feat picks from
   * every maneuver the catalog holds, and what a table may legally offer is a
   * question for the picker rather than for the ETL.
   */
  it("totals a character's options across the class, the subclass and every grant held", () => {
    buildContent({ vendorDir: FIXTURE_VENDOR, dbPath, loaders: LOADERS, meta: {} });

    const db = new Database(dbPath, { readonly: true });
    const maneuvers = (grantors: [string, string, string][]): number =>
      db
        .prepare(
          `SELECT COALESCE(SUM(known), 0) FROM (
             SELECT known FROM class_optional_features
              WHERE class_name = 'Fighter' AND class_source = 'XPHB'
                AND level = 7 AND feature_type = 'MV:B'
             UNION ALL
             SELECT known FROM subclass_optional_features
              WHERE class_name = 'Fighter' AND class_source = 'XPHB'
                AND subclass_name = 'Battle Master' AND subclass_source = 'XPHB'
                AND level = 7 AND feature_type = 'MV:B'
             UNION ALL
             SELECT known FROM granted_optional_features
              WHERE feature_type = 'MV:B'
                AND (granted_by, name, source) IN
                    (VALUES ${grantors.map(() => "(?, ?, ?)").join(", ")}))`,
        )
        .pluck()
        .get(grantors.flat()) as number;

    const feat = maneuvers([["feats", "Martial Adept", "PHB"]]);
    const andAnOption = maneuvers([
      ["feats", "Martial Adept", "PHB"],
      ["optional_features", "Superior Technique", "TCE"],
    ]);
    const pool = db
      .prepare("SELECT COUNT(*) FROM optional_feature_types WHERE feature_type = ?")
      .pluck()
      .get("MV:B");
    db.close();

    expect({ feat, andAnOption, pool }).toEqual({ feat: 7, andAnOption: 8, pool: 2 });
  });
});
