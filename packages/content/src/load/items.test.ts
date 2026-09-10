import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildContent } from "../build-db.ts";
import { EDITION_FILES } from "./edition.ts";
import { items } from "./items.ts";

const FIXTURE_VENDOR = join(import.meta.dirname, "../../../../tests/fixtures/5etools");

describe("the items loader", () => {
  let workspace: string;
  let dbPath: string;

  const build = (vendorDir: string) =>
    buildContent({ vendorDir, dbPath, loaders: [items], meta: {} });

  const open = () => new Database(dbPath, { readonly: true });

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "content-items-"));
    dbPath = join(workspace, "data", "content.db");
  });

  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  it("keys a row by (name, source) and records the array it came from", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rows = db
      .prepare(
        `SELECT name, source, edition, kind, type, rarity, requires_attunement
           FROM items ORDER BY kind, source, name`,
      )
      .all();
    db.close();

    expect(rows).toEqual([
      row("Alchemist's Supplies", "PHB", "classic", "baseitem", "AT", "none", 0),
      row("Longsword", "PHB", "classic", "baseitem", "M", "none", 0),
      row("Longsword", "XPHB", "one", "baseitem", "M|XPHB", "none", 0),
      row("+1 Wand of the War Mage", "DMG", "classic", "item", "WD|DMG", "uncommon", 1),
      row("Bag of Holding", "DMG", "classic", "item", null, "uncommon", 0),
      row("Wand of Magic Missiles", "DMG", "classic", "item", "WD|DMG", "uncommon", 0),
      row("Ascendant Dragon Vessel", "FTD", "classic", "item", null, "legendary", 1),
      row("Slumbering Dragon Vessel", "FTD", "classic", "item", null, "uncommon", 1),
      row("Stirring Dragon Vessel", "FTD", "classic", "item", null, "rare", 1),
      row("Wakened Dragon Vessel", "FTD", "classic", "item", null, "very rare", 1),
      row("Borderlands Tabard", "HotB", "one", "item", "G|XPHB", "none", 0),
      row("Dragon Thighbone Club", "SKT", "classic", "item", "M", "unknown (magic)", 0),
      row("Charred Wand of Magic Missiles", "WDH", "classic", "item", "WD|DMG", "uncommon", 0),
      row("Cloak of Billowing", "WttHC", "one", "item", null, "common", 0),
      row("Cloak of Billowing", "XDMG", "one", "item", null, "common", 0),
      row("Arcane Focus", "PHB", "classic", "itemGroup", "SCF", "none", 0),
      row("Arrow of Slaying (*)", "DMG", "classic", "magicvariant", null, "very rare", 0),
      row("Armblade", "ERLW", "classic", "magicvariant", null, "common", 1),
      row("Ammunition of Slaying", "XDMG", "one", "magicvariant", null, "very rare", 0),
    ]);
  });

  /**
   * The two mechanisms the table above cannot tell apart. A base item is the
   * first Tier A entry to declare an `edition` of its own, and the adventures
   * are the first sources whose 2025 publish date is the only thing saying they
   * are `one` — a hand-kept list of 2024 abbreviations filed both as `classic`.
   */
  it("prefers an entry's own edition and falls back to when its source was published", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const declared = db
      .prepare("SELECT json_extract(json, '$.edition') FROM items WHERE name = ? AND source = ?")
      .pluck()
      .get("Longsword", "PHB");
    const fromDate = db
      .prepare(
        "SELECT source, edition FROM items WHERE source IN ('HotB', 'WttHC') ORDER BY source",
      )
      .all();
    db.close();

    expect(declared).toBe("classic");
    expect(fromDate).toEqual([
      { source: "HotB", edition: "one" },
      { source: "WttHC", edition: "one" },
    ]);
  });

  it("reads a magic variant's source and attunement from the inherits block", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const json = db
      .prepare("SELECT json FROM items WHERE kind = 'magicvariant' AND name = ?")
      .pluck()
      .get("Armblade") as string;
    db.close();

    const entry = JSON.parse(json) as { inherits: { source: string; reqAttune: string } };
    expect(entry.inherits).toMatchObject({ source: "ERLW", reqAttune: "by a warforged" });
  });

  it("counts optional attunement as not required and keeps the condition readable", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const club = db
      .prepare("SELECT requires_attunement, json FROM items WHERE name = ?")
      .get("Dragon Thighbone Club") as { requires_attunement: number; json: string };
    const wand = db
      .prepare("SELECT requires_attunement, json FROM items WHERE name = ?")
      .get("+1 Wand of the War Mage") as { requires_attunement: number; json: string };
    db.close();

    expect([club.requires_attunement, JSON.parse(club.json).reqAttune]).toEqual([0, "optional"]);
    expect([wand.requires_attunement, JSON.parse(wand.json).reqAttune]).toEqual([
      1,
      "by a spellcaster",
    ]);
  });

  const LONGSWORD = { name: "Longsword", source: "PHB", type: "M", rarity: "none" };

  const vendorHolding = (files: Record<string, unknown>): string => {
    const vendorDir = join(workspace, "vendor");
    for (const [path, contents] of Object.entries({
      "data/items.json": { item: [], itemGroup: [] },
      "data/items-base.json": { baseitem: [] },
      "data/magicvariants.json": { magicvariant: [] },
      ...files,
    })) {
      const destination = join(vendorDir, path);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, JSON.stringify(contents));
    }
    for (const file of EDITION_FILES) {
      const destination = join(vendorDir, file);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(join(FIXTURE_VENDOR, file), destination);
    }
    return vendorDir;
  };

  /** The reason rather than the `Loader "items" failed` wrapper every failure shares. */
  const refusal = (vendorDir: string): string => {
    try {
      build(vendorDir);
    } catch (error) {
      const { cause } = error as Error;
      return cause instanceof Error ? cause.message : String(cause);
    }
    throw new Error("the build succeeded");
  };

  const holdingBase = (...entries: unknown[]) =>
    vendorHolding({ "data/items-base.json": { baseitem: entries } });

  it("fails the build when two entries share a (name, source)", () => {
    expect(refusal(holdingBase(LONGSWORD, LONGSWORD))).toMatch(
      /UNIQUE constraint failed: items\.name, items\.source/,
    );
  });

  /** A base item and a magic item never collide upstream, so one is a fetch gone wrong. */
  it("fails the build when a base item and an item share a (name, source)", () => {
    const vendorDir = vendorHolding({
      "data/items-base.json": { baseitem: [LONGSWORD] },
      "data/items.json": { item: [LONGSWORD], itemGroup: [] },
    });

    expect(refusal(vendorDir)).toMatch(/UNIQUE constraint failed: items\.name, items\.source/);
  });

  it.each([
    ["no name", { name: undefined }, /name is missing or not a string/],
    ["a type that is not a string", { type: 7 }, /type is not a string/],
    ["a rarity that is not a string", { rarity: [] }, /rarity is not a string/],
    ["a type that is the empty string", { type: "" }, /type is empty/],
    [
      "an attunement flag that is a number",
      { reqAttune: 1 },
      /reqAttune 1 is neither a flag nor a condition/,
    ],
  ])("refuses an entry with %s", (_, override, reason) => {
    expect(refusal(holdingBase({ ...LONGSWORD, ...override }))).toMatch(reason);
  });

  it("refuses a magic variant whose inherits declares an edition", () => {
    const vendorDir = vendorHolding({
      "data/magicvariants.json": {
        magicvariant: [{ name: "+1 Weapon", inherits: { source: "DMG", edition: "one" } }],
      },
    });

    expect(refusal(vendorDir)).toMatch(/inherits declares an edition/);
  });

  it("refuses a magic variant with no inherits block", () => {
    const vendorDir = vendorHolding({
      "data/magicvariants.json": { magicvariant: [{ name: "+1 Weapon" }] },
    });

    expect(refusal(vendorDir)).toMatch(/inherits is missing or not an object/);
  });

  it("reports a missing declared file rather than refusing the entry", () => {
    const vendorDir = holdingBase(LONGSWORD);
    rmSync(join(vendorDir, "data/magicvariants.json"));

    expect(() => build(vendorDir)).toThrow(/Loader "items" failed/);
    expect(refusal(vendorDir)).toMatch(/matches data\/magicvariants\.json/);
  });
});

function row(
  name: string,
  source: string,
  edition: string,
  kind: string,
  type: string | null,
  rarity: string | null,
  requires_attunement: number,
) {
  return { name, source, edition, kind, type, rarity, requires_attunement };
}
