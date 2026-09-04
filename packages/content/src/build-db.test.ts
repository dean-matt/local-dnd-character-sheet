import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildContent } from "./build-db.ts";
import type { Loader } from "./load/index.ts";

/**
 * Fences the loader framework: the registry runs in order inside one
 * transaction, and a failure anywhere in it leaves no database behind.
 */
describe("buildContent", () => {
  let workspace: string;
  let vendorDir: string;
  let dbPath: string;

  const lookup = (name: string): Loader => ({
    name,
    files: ["data/*.json"],
    rows: (sources) => ({
      lookups: [...sources.values()].flatMap((source) =>
        (source as { entries: string[] }).entries.map((entry) => ({
          kind: name,
          name: entry,
          source: "PHB",
          edition: "classic",
          json: "{}",
        })),
      ),
    }),
  });

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "content-build-"));
    vendorDir = join(workspace, "vendor");
    dbPath = join(workspace, "data", "content.db");
    mkdirSync(join(vendorDir, "data"), { recursive: true });
    writeFileSync(join(vendorDir, "data", "conditions.json"), '{"entries":["Blinded","Prone"]}');
  });

  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  it("stamps meta, inserts loader rows and returns a count per table", () => {
    const counts = buildContent({
      vendorDir,
      dbPath,
      loaders: [lookup("condition"), lookup("status")],
      meta: { upstream_tag: "v2.34.1" },
    });

    expect(counts).toEqual({ lookups: 4 });
    const db = new Database(dbPath, { readonly: true });
    expect(db.prepare("SELECT value FROM meta WHERE key = 'upstream_tag'").pluck().get()).toBe(
      "v2.34.1",
    );
    expect(db.prepare("SELECT kind, name FROM lookups ORDER BY rowid").all()).toEqual([
      { kind: "condition", name: "Blinded" },
      { kind: "condition", name: "Prone" },
      { kind: "status", name: "Blinded" },
      { kind: "status", name: "Prone" },
    ]);
    db.close();
  });

  it("runs the registry in array order, so a loader can depend on an earlier table", () => {
    const order: string[] = [];
    const record = (name: string): Loader => ({
      ...lookup(name),
      rows: (sources) => {
        order.push(name);
        return lookup(name).rows(sources);
      },
    });

    buildContent({ vendorDir, dbPath, loaders: [record("first"), record("second")], meta: {} });

    expect(order).toEqual(["first", "second"]);
  });

  it("aborts the whole build when one loader throws, leaving no database", () => {
    const exploding: Loader = {
      name: "broken",
      files: ["data/*.json"],
      rows: () => {
        throw new Error("bad row");
      },
    };

    expect(() =>
      buildContent({ vendorDir, dbPath, loaders: [lookup("condition"), exploding], meta: {} }),
    ).toThrow(/Loader "broken" failed/);
    expect(existsSync(dbPath)).toBe(false);
    expect(existsSync(`${dbPath}.incoming`)).toBe(false);
  });

  it("names the loader when a source file is missing", () => {
    const absent: Loader = { name: "spells", files: ["data/spells/*.json"], rows: () => ({}) };

    expect(() => buildContent({ vendorDir, dbPath, loaders: [absent], meta: {} })).toThrow(
      /Loader "spells" failed/,
    );
  });
});
