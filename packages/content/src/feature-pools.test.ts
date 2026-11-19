import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FEATURE_POOL_ENTRIES } from "@dnd/character";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildContent, resolveContentDb } from "./build-db.ts";
import { classes } from "./load/classes.ts";

const VENDOR = join(import.meta.dirname, "../../../vendor/5etools");

/** Each class, by `(name, source)`, that holds the feature at any level or through any subclass. */
const HOLDERS = `
  SELECT class_name, class_source FROM class_features WHERE name = ? AND source = ?
  UNION
  SELECT class_name, class_source FROM subclass_features WHERE name = ? AND source = ?`;

const CARRIES = `
  SELECT 1 FROM class_resources
   WHERE class_name = ? AND class_source = ? AND resource_key = ? LIMIT 1`;

type Holder = { class_name: string; class_source: string };

/** Labels each pool entry whose key no class holding its feature carries. */
function unresolved(db: Database.Database): string[] {
  const holders = db.prepare(HOLDERS);
  const carries = db.prepare(CARRIES);
  return FEATURE_POOL_ENTRIES.filter(({ ref, key }) => {
    const held = holders.all(ref.name, ref.source, ref.name, ref.source) as Holder[];
    return !held.some((c) => carries.get(c.class_name, c.class_source, key) !== undefined);
  }).map(({ ref, key }) => `${ref.name}|${ref.source} -> ${key}`);
}

describe.skipIf(!existsSync(join(VENDOR, "data/class")))(
  "the feature pools against vendor/",
  () => {
    let workspace = "";

    beforeEach(() => {
      workspace = mkdtempSync(join(tmpdir(), "content-pools-"));
    });

    afterEach(() => rmSync(workspace, { recursive: true, force: true }));

    it("name a resource key the class table of a class holding the feature carries", () => {
      const contentDir = join(workspace, "data", "content");
      buildContent({ vendorDir: VENDOR, contentDir, loaders: [classes], meta: {} });
      const db = new Database(resolveContentDb(contentDir), { readonly: true });
      try {
        expect(unresolved(db)).toEqual([]);
      } finally {
        db.close();
      }
    });
  },
);
