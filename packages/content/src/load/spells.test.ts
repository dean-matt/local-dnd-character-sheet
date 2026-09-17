import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildContent } from "../build-db.ts";
import { EDITION_FILES } from "./edition.ts";
import { spells } from "./spells.ts";

const FIXTURE_VENDOR = join(import.meta.dirname, "../../../../tests/fixtures/5etools");

describe("the spells loader", () => {
  let workspace: string;
  let dbPath: string;

  const build = (vendorDir: string) =>
    buildContent({ vendorDir, dbPath, loaders: [spells], meta: {} });

  const open = () => new Database(dbPath, { readonly: true });

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "content-spells-"));
    dbPath = join(workspace, "data", "content.db");
  });

  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  it("keys a row by (name, source) and derives the edition from the source", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rows = db
      .prepare(
        "SELECT name, source, edition, level, school, concentration, ritual FROM spells ORDER BY source, name",
      )
      .all();
    db.close();

    expect(rows).toEqual([
      {
        name: "Acid Splash",
        source: "PHB",
        edition: "classic",
        level: 0,
        school: "C",
        concentration: 0,
        ritual: 0,
      },
      {
        name: "Detect Magic",
        source: "PHB",
        edition: "classic",
        level: 1,
        school: "D",
        concentration: 1,
        ritual: 1,
      },
      {
        name: "Acid Splash",
        source: "XPHB",
        edition: "one",
        level: 0,
        school: "V",
        concentration: 0,
        ritual: 0,
      },
      {
        name: "Detect Magic",
        source: "XPHB",
        edition: "one",
        level: 1,
        school: "D",
        concentration: 1,
        ritual: 1,
      },
    ]);
  });

  it("maps a spell to the classes data/spells/sources.json grants it to", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rows = db
      .prepare(
        "SELECT spell_name, spell_source, class_name, class_source FROM spell_classes " +
          "ORDER BY spell_source, spell_name, class_name",
      )
      .all();
    db.close();

    expect(rows).toEqual([
      {
        spell_name: "Acid Splash",
        spell_source: "PHB",
        class_name: "Artificer",
        class_source: "TCE",
      },
      {
        spell_name: "Detect Magic",
        spell_source: "PHB",
        class_name: "Artificer",
        class_source: "TCE",
      },
      {
        spell_name: "Detect Magic",
        spell_source: "PHB",
        class_name: "Cleric",
        class_source: "PHB",
      },
    ]);
  });

  it("keeps the rest of the entry in json, tag markup untouched", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const json = db
      .prepare("SELECT json FROM spells WHERE name = ? AND source = ?")
      .pluck()
      .get("Acid Splash", "XPHB") as string;
    db.close();

    const entry = JSON.parse(json) as { page: number; entries: string[] };
    expect(entry.page).toBe(239);
    expect(entry.entries[0]).toContain("{@variantrule Sphere [Area of Effect]|XPHB|Sphere}");
  });

  const FIREBALL = {
    name: "Fireball",
    source: "PHB",
    level: 3,
    school: "V",
    duration: [{ type: "instant" }],
  };

  const writeVendor = (
    spellEntries: unknown[],
    sourcesJson: unknown,
    classEntries: unknown[],
  ): string => {
    const vendorDir = join(workspace, "vendor");
    mkdirSync(join(vendorDir, "data", "spells"), { recursive: true });
    writeFileSync(
      join(vendorDir, "data", "spells", "spells-phb.json"),
      JSON.stringify({ spell: spellEntries }),
    );
    writeFileSync(join(vendorDir, "data", "spells", "sources.json"), JSON.stringify(sourcesJson));
    mkdirSync(join(vendorDir, "data", "class"), { recursive: true });
    writeFileSync(
      join(vendorDir, "data", "class", "class-test.json"),
      JSON.stringify({ class: classEntries }),
    );
    for (const file of EDITION_FILES) {
      const destination = join(vendorDir, file);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(join(FIXTURE_VENDOR, file), destination);
    }
    return vendorDir;
  };

  const vendorHolding = (...entries: unknown[]): string => writeVendor(entries, {}, []);

  /**
   * The reason, not the wrapper. `buildContent` reports every loader failure as
   * `Loader "spells" failed` — including a vendor directory missing a file the
   * loader declared, which is what a broken `vendorHolding` looks like. Asserting
   * the wrapper passes whether or not the entry was refused for the stated reason.
   */
  const refusal = (vendorDir: string): string => {
    try {
      build(vendorDir);
    } catch (error) {
      const { cause } = error as Error;
      return cause instanceof Error ? cause.message : String(cause);
    }
    throw new Error("the build succeeded");
  };

  it("fails the build when two entries share a (name, source)", () => {
    expect(refusal(vendorHolding(FIREBALL, FIREBALL))).toMatch(
      /UNIQUE constraint failed: spells\.name, spells\.source/,
    );
  });

  it.each([
    ["a level that is not a number", { level: "third" }, /level third is not a whole number/],
    ["no school", { school: undefined }, /school is missing or not a string/],
    ["no duration", { duration: undefined }, /duration is missing or not a list of spans/],
    [
      "a duration that is not a list",
      { duration: { type: "instant" } },
      /duration is missing or not a list of spans/,
    ],
  ])("refuses an entry with %s", (_, override, reason) => {
    expect(refusal(vendorHolding({ ...FIREBALL, ...override }))).toMatch(reason);
  });

  it("reports a missing declared file rather than refusing the entry", () => {
    const vendorDir = vendorHolding(FIREBALL);
    rmSync(join(vendorDir, EDITION_FILES[0] as string));

    expect(() => build(vendorDir)).toThrow(/Loader "spells" failed/);
    expect(refusal(vendorDir)).toMatch(/matches data\/books\.json/);
  });

  const WIZARD = { name: "Wizard", source: "PHB" };

  it("grants a spell to a class named only under classVariant", () => {
    const vendorDir = writeVendor([FIREBALL], { PHB: { Fireball: { classVariant: [WIZARD] } } }, [
      WIZARD,
    ]);
    build(vendorDir);

    const db = open();
    const rows = db.prepare("SELECT class_name, class_source FROM spell_classes").all();
    db.close();

    expect(rows).toEqual([{ class_name: "Wizard", class_source: "PHB" }]);
  });

  it("keeps a spell's grants findable by its own edition", () => {
    const PRESTIDIGITATION = {
      name: "Prestidigitation",
      source: "XPHB",
      level: 0,
      school: "T",
      duration: [{ type: "instant" }],
    };
    const vendorDir = writeVendor(
      [FIREBALL, PRESTIDIGITATION],
      {
        PHB: { Fireball: { class: [WIZARD] } },
        XPHB: { Prestidigitation: { class: [WIZARD] } },
      },
      [WIZARD],
    );
    build(vendorDir);

    const db = open();
    const classic = db
      .prepare(
        "SELECT sc.spell_name FROM spell_classes sc " +
          "JOIN spells s ON s.name = sc.spell_name AND s.source = sc.spell_source " +
          "WHERE s.edition = 'classic'",
      )
      .pluck()
      .all();
    db.close();

    expect(classic).toEqual(["Fireball"]);
  });

  it("inserts one row for a (spell, class) pair class and classVariant both name", () => {
    const vendorDir = writeVendor(
      [FIREBALL],
      { PHB: { Fireball: { class: [WIZARD], classVariant: [WIZARD] } } },
      [WIZARD],
    );
    build(vendorDir);

    const db = open();
    const count = db.prepare("SELECT COUNT(*) FROM spell_classes").pluck().get();
    db.close();

    expect(count).toBe(1);
  });

  it("fails the build when sources.json names a spell no spells row holds", () => {
    const vendorDir = writeVendor([FIREBALL], { PHB: { "Magic Missile": { class: [WIZARD] } } }, [
      WIZARD,
    ]);

    expect(refusal(vendorDir)).toMatch(
      /sources\.json\.PHB\.Magic Missile names a spell no spells row holds/,
    );
  });

  it("fails the build when a grantor names a class no row holds", () => {
    const vendorDir = writeVendor(
      [FIREBALL],
      { PHB: { Fireball: { class: [{ name: "Ghost", source: "PHB" }] } } },
      [],
    );

    expect(refusal(vendorDir)).toMatch(/names class Ghost\|PHB, which no row holds/);
  });

  it("fails the build when the only row for a grantor is a sidekick", () => {
    const vendorDir = writeVendor(
      [FIREBALL],
      { PHB: { Fireball: { class: [{ name: "Expert", source: "PHB" }] } } },
      [{ name: "Expert", source: "PHB", isSidekick: true }],
    );

    expect(refusal(vendorDir)).toMatch(/names class Expert\|PHB, which no row holds/);
  });
});
