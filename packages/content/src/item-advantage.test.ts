import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ITEM_ADVANTAGES } from "@dnd/catalog";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildContent, resolveContentDb } from "./build-db.ts";
import { items } from "./load/items.ts";

const FIXTURE_VENDOR = join(import.meta.dirname, "../../../tests/fixtures/5etools");
const VENDOR = join(import.meta.dirname, "../../../vendor/5etools");

/** The rows at the pinned tag whose rules text mentions advantage or disadvantage, read in full. */
const SEARCHED = 336;

type Row = { name: string; source: string; json: string };

/**
 * The search the mapping starts from: every catalog row whose rules text mentions advantage
 * or disadvantage. A magic variant keeps its text under `inherits`; the rest keep it in
 * `entries`, which a `_copy` has already resolved by the time it is a row.
 */
function mentionsAdvantage({ json }: Row): boolean {
  const row = JSON.parse(json) as { entries?: unknown; inherits?: { entries?: unknown } };
  const text = JSON.stringify(row.entries ?? row.inherits?.entries ?? []);
  return /\b(?:dis)?advantage\b/i.test(text);
}

describe("the item advantage mapping", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "content-advantage-"));
  });

  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  const rowsFrom = (vendorDir: string): Row[] => {
    const contentDir = join(workspace, "data", "content");
    buildContent({ vendorDir, contentDir, loaders: [items], meta: {} });
    const db = new Database(resolveContentDb(contentDir), { readonly: true });
    try {
      return db.prepare("SELECT name, source, json FROM items").all() as Row[];
    } finally {
      db.close();
    }
  };

  const missing = (rows: readonly Row[]) => {
    const held = new Set(rows.map(({ name, source }) => `${name}|${source}`));
    return ITEM_ADVANTAGES.map(({ name, source }) => `${name}|${source}`).filter(
      (key) => !held.has(key),
    );
  };

  it("names only items the fixtures carry, so a renamed or mistyped key fails here", () => {
    expect(missing(rowsFrom(FIXTURE_VENDOR))).toEqual([]);
  });

  describe.skipIf(!existsSync(join(VENDOR, "data/items.json")))("against vendor/", () => {
    it("names only items the pinned tag still ships, and every one still mentions advantage", () => {
      const rows = rowsFrom(VENDOR);
      expect(missing(rows)).toEqual([]);

      const found = new Set(rows.filter(mentionsAdvantage).map((r) => `${r.name}|${r.source}`));
      const gone = ITEM_ADVANTAGES.map(({ name, source }) => `${name}|${source}`).filter(
        (key) => !found.has(key),
      );
      expect(gone).toEqual([]);
    });

    it("finds the rows the mapping was drawn from, so a new tag's additions get read", () => {
      const found = rowsFrom(VENDOR).filter(mentionsAdvantage);
      // Re-read the rows the search turns up when this changes, then map or pass over each.
      expect(found).toHaveLength(SEARCHED);
    });
  });
});
