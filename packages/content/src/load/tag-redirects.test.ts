import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildContent } from "../build-db.ts";
import { tagRedirects } from "./tag-redirects.ts";

const FIXTURE_VENDOR = join(import.meta.dirname, "../../../../tests/fixtures/5etools");
const FILE = "data/generated/gendata-tag-redirects.json";

describe("the tag redirects loader", () => {
  let workspace: string;
  let dbPath: string;

  const build = (vendorDir: string) =>
    buildContent({ vendorDir, dbPath, loaders: [tagRedirects], meta: {} });

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "content-redirects-"));
    dbPath = join(workspace, "data", "content.db");
  });

  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  it("repeats the namespace for a local target and names the other one for a jump", () => {
    build(FIXTURE_VENDOR);

    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare("SELECT * FROM tag_redirects ORDER BY tag, from_key").all();
    db.close();

    expect(rows).toEqual([
      {
        tag: "actions.html",
        from_key: "dash_phb",
        to_tag: "actions.html",
        to_key: "dash_xphb",
      },
      {
        tag: "actions.html",
        from_key: "grapple_phb",
        to_tag: "variantrules.html",
        to_key: "unarmed%20strike_xphb",
      },
      {
        tag: "skill",
        from_key: "acrobatics_phb",
        to_tag: "skill",
        to_key: "acrobatics_xphb",
      },
      {
        tag: "skill",
        from_key: "animal%20handling_phb",
        to_tag: "skill",
        to_key: "animal%20handling_xphb",
      },
    ]);
  });

  it("refuses a target that is neither a hash nor a hash and page", () => {
    const vendorDir = join(workspace, "vendor");
    const file = join(vendorDir, FILE);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ "actions.html": { dash_phb: { page: "actions.html" } } }));

    try {
      build(vendorDir);
    } catch (error) {
      const { cause } = error as Error;
      expect(String(cause)).toMatch(/actions\.html dash_phb: target is neither a hash/);
      return;
    }
    throw new Error("the build succeeded");
  });
});
