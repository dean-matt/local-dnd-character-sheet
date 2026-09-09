import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildContent } from "../build-db.ts";
import { characterOptions } from "./character-options.ts";

const FIXTURE_VENDOR = join(import.meta.dirname, "../../../../tests/fixtures/5etools");

describe("the character options loader", () => {
  let workspace: string;
  let dbPath: string;

  const build = (vendorDir: string) =>
    buildContent({ vendorDir, dbPath, loaders: [characterOptions], meta: {} });

  const open = () => new Database(dbPath, { readonly: true });

  const identities = (table: string): string[] => {
    const db = open();
    const rows = db
      .prepare(`SELECT name, source, edition FROM ${table} ORDER BY name, source`)
      .all() as { name: string; source: string; edition: string }[];
    db.close();
    return rows.map(({ name, source, edition }) => `${name}|${source} ${edition}`);
  };

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "content-options-"));
    dbPath = join(workspace, "data", "content.db");
  });

  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  it("loads backgrounds, keyed by name and source", () => {
    build(FIXTURE_VENDOR);

    expect(identities("backgrounds")).toEqual([
      "Acolyte|PHB classic",
      "Acolyte|XPHB one",
      "Augen Trust (Spy)|EGW classic",
      "Baldur's Gate Acolyte|BGDIA classic",
      "Criminal|PHB classic",
      "Variant Criminal (Spy)|PHB classic",
    ]);
  });

  it("loads feats, with a _versions variant standing beside the entry it came from", () => {
    build(FIXTURE_VENDOR);

    expect(identities("feats")).toEqual([
      "Alert|PHB classic",
      "Alert|XPHB one",
      "Magic Initiate|XPHB one",
      "Magic Initiate; Cleric|XPHB one",
      "Magic Initiate; Druid|XPHB one",
    ]);
  });

  it("keeps an optional feature to one row however many types offer it", () => {
    build(FIXTURE_VENDOR);

    expect(identities("optional_features")).toEqual([
      "Agonizing Blast|XPHB one",
      "Archery|PHB classic",
      "Dueling|PHB classic",
    ]);

    const db = open();
    const types = db
      .prepare(
        "SELECT feature_type FROM optional_feature_types WHERE name = ? AND source = ? ORDER BY feature_type",
      )
      .pluck()
      .all("Dueling", "PHB");
    db.close();

    expect(types).toEqual(["FS:B", "FS:F", "FS:P", "FS:R"]);
  });

  it("finds every fighting style a class is offered, which is the point of the table", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rangers = db
      .prepare(
        "SELECT f.name FROM optional_features f JOIN optional_feature_types t " +
          "ON t.name = f.name AND t.source = f.source WHERE t.feature_type = ? ORDER BY f.name",
      )
      .pluck()
      .all("FS:R");
    db.close();

    expect(rangers).toEqual(["Archery", "Dueling"]);
  });

  /** The fixture vendor with one file swapped, so a refusal has everything else to read. */
  const vendorHolding = (file: string, contents: unknown): string => {
    const vendorDir = join(workspace, "vendor");
    cpSync(FIXTURE_VENDOR, vendorDir, { recursive: true });
    writeFileSync(join(vendorDir, file), JSON.stringify(contents));
    return vendorDir;
  };

  const refusal = (vendorDir: string): string => {
    try {
      build(vendorDir);
    } catch (error) {
      const { cause } = error as Error;
      return cause instanceof Error ? cause.message : String(cause);
    }
    throw new Error("the build succeeded");
  };

  /**
   * Nothing upstream disagrees with its own source: all 78 entries that declare
   * an `edition` at the pinned tag agree with the date their book was published,
   * so the fixture cannot tell precedence from the fallback and this is written
   * out by hand instead.
   */
  it("takes an entry's declared edition over the one its source implies", () => {
    build(
      vendorHolding("data/backgrounds.json", {
        background: [
          { name: "Backdated", source: "XPHB", edition: "classic" },
          { name: "Undated", source: "XPHB" },
        ],
      }),
    );

    expect(identities("backgrounds")).toEqual(["Backdated|XPHB classic", "Undated|XPHB one"]);
  });

  it("refuses an edition an entry declares that is neither ruleset", () => {
    expect(
      refusal(
        vendorHolding("data/backgrounds.json", {
          background: [{ name: "Wrong", source: "XPHB", edition: "2024" }],
        }),
      ),
    ).toMatch(/edition "2024" is neither classic nor one/);
  });

  it("refuses a file missing the array it is read for", () => {
    expect(refusal(vendorHolding("data/feats.json", { feature: [] }))).toMatch(
      /data\/feats\.json carries no feat array/,
    );
  });

  it.each([
    ["no featureType at all", {}],
    ["an empty featureType", { featureType: [] }],
  ])("refuses an optional feature with %s", (_, override) => {
    expect(
      refusal(
        vendorHolding("data/optionalfeatures.json", {
          optionalfeature: [{ name: "Dueling", source: "PHB", ...override }],
        }),
      ),
    ).toMatch(/featureType is missing or empty/);
  });

  it("fails the build when two entries share a (name, source)", () => {
    const twin = { name: "Alert", source: "PHB" };
    expect(refusal(vendorHolding("data/feats.json", { feat: [twin, twin] }))).toMatch(
      /UNIQUE constraint failed: feats\.name, feats\.source/,
    );
  });
});
