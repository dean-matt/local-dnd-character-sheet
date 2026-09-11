import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildContent } from "../build-db.ts";
import { lookups } from "./lookups.ts";

const FIXTURE_VENDOR = join(import.meta.dirname, "../../../../tests/fixtures/5etools");

type Identity = {
  kind: string;
  name: string;
  source: string;
  qualifier: string;
  edition: string | null;
};

describe("the lookups loader", () => {
  let workspace: string;
  let dbPath: string;

  const build = (vendorDir: string) =>
    buildContent({ vendorDir, dbPath, loaders: [lookups], meta: {} });

  const open = () => new Database(dbPath, { readonly: true });

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "content-lookups-"));
    dbPath = join(workspace, "data", "content.db");
  });

  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  it("keys every kind by (kind, name, source, qualifier) with an edition per ruleset", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rows = db
      .prepare(
        "SELECT kind, name, source, qualifier, edition FROM lookups ORDER BY kind, name, source, qualifier",
      )
      .all() as Identity[];
    db.close();

    expect(
      rows.map(
        ({ kind, name, source, qualifier, edition }) =>
          `${kind} ${name}|${source}${qualifier && `|${qualifier}`} ${edition}`,
      ),
    ).toEqual([
      "action Dash|PHB classic",
      "action Dash|XPHB one",
      "condition Blinded|PHB classic",
      "condition Blinded|XPHB one",
      "deity Bahgtru|SCAG|Orc classic",
      "deity Bahgtru|VGM|Orc classic",
      "deity Moradin|PHB|Nonhuman classic",
      "deity Oghma|PHB|Celtic classic",
      "deity Oghma|PHB|Forgotten Realms classic",
      "disease Blinding Sickness|PHB classic",
      "itemEntry Armor of Resistance|DMG classic",
      "itemMastery Cleave|XPHB one",
      "itemProperty 2H|PHB classic",
      "itemProperty 2H|XPHB one",
      "itemProperty S|PHB classic",
      "itemType AIR|DMG classic",
      "itemType M|XPHB one",
      "itemType SHP|DMG classic",
      "itemTypeAdditionalEntries Gaming Set|XGE classic",
      "language Common|PHB classic",
      "language Common|XPHB one",
      "language Draconic|PHB classic",
      "languageScript Draconic|PHB classic",
      "psionic Mastery of Force|UATheMysticClass classic",
      "sense Darkvision|PHB classic",
      "sense Darkvision|XPHB one",
      "skill Acrobatics|PHB classic",
      "skill Acrobatics|XPHB one",
      "status Bloodied|XPHB one",
      "table Damage Types|PHB classic",
      "variantrule Cover|XPHB one",
      "variantrule Customizing Ability Scores|PHB classic",
    ]);
  });

  it("keeps the entry in json, tag markup untouched", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const json = db
      .prepare("SELECT json FROM lookups WHERE kind = ? AND name = ? AND source = ?")
      .pluck()
      .get("action", "Dash", "XPHB") as string;
    db.close();

    const entry = JSON.parse(json) as { entries: string[] };
    expect(entry.entries.join(" ")).toContain("{@variantrule Speed|XPHB}");
  });

  it("resolves a _copy whose parent is named by pantheon as well as by name and source", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const json = db
      .prepare("SELECT json FROM lookups WHERE kind = 'deity' AND source = 'VGM'")
      .pluck()
      .get() as string;
    db.close();

    const entry = JSON.parse(json) as Record<string, unknown>;
    expect(entry).not.toHaveProperty("_copy");
    expect(entry.symbol).toBe("Broken thigh bone");
    expect(entry.title).toBe("the Leg Breaker");
  });

  it("names an item property and an item type by the abbreviation their links spell", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const named = db
      .prepare("SELECT name FROM lookups WHERE kind = 'itemProperty' AND source = 'PHB'")
      .pluck()
      .all() as string[];
    db.close();

    expect(named).toEqual(["2H", "S"]);
  });

  it("resolves an itemType _copy whose parent is named by abbreviation", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const json = db
      .prepare("SELECT json FROM lookups WHERE kind = 'itemType' AND name = 'AIR'")
      .pluck()
      .get() as string;
    db.close();

    const entry = JSON.parse(json) as { name: string; entries: { name: string }[] };
    expect(entry.name).toBe("Vehicle (Air)");
    expect(entry.entries.map((section) => section.name)).toContain("Ship Repair");
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

  it("refuses a file missing one of the kinds it carries", () => {
    expect(refusal(vendorHolding("data/conditionsdiseases.json", { condition: [] }))).toMatch(
      /data\/conditionsdiseases\.json carries no disease array/,
    );
  });

  it("refuses an entry with no source", () => {
    expect(refusal(vendorHolding("data/skills.json", { skill: [{ name: "Acrobatics" }] }))).toMatch(
      /data\/skills\.json skill\[0\]: source is missing or not a string/,
    );
  });

  it("refuses a deity with no pantheon, which is the third part of its key", () => {
    expect(
      refusal(vendorHolding("data/deities.json", { deity: [{ name: "Oghma", source: "PHB" }] })),
    ).toMatch(/data\/deities\.json deity\[0\]: pantheon is missing or not a string/);
  });

  it("refuses an item property with no abbreviation, which is the name its link spells", () => {
    expect(
      refusal(
        vendorHolding("data/items-base.json", {
          baseitem: [],
          itemProperty: [{ name: "special", source: "PHB" }],
          itemType: [],
          itemMastery: [],
          itemEntry: [],
          itemTypeAdditionalEntries: [],
        }),
      ),
    ).toMatch(/data\/items-base\.json itemProperty\[0\]: abbreviation is missing or not a string/);
  });

  it("fails the build when two entries share a whole key", () => {
    const twins = { name: "Acrobatics", source: "PHB" };
    expect(refusal(vendorHolding("data/skills.json", { skill: [twins, twins] }))).toMatch(
      /UNIQUE constraint failed/,
    );
  });
});
