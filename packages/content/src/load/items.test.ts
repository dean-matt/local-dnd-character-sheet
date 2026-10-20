import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ITEM_ADVANTAGES, itemEntries } from "@dnd/catalog";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildContent, resolveContentDb } from "../build-db.ts";
import { EDITION_FILES } from "./edition.ts";
import { items } from "./items.ts";

const MAPPED = new Set(ITEM_ADVANTAGES.map(({ name, source }) => `${name}|${source}`));

const FIXTURE_VENDOR = join(import.meta.dirname, "../../../../tests/fixtures/5etools");

describe("the items loader", () => {
  let workspace: string;
  let contentDir: string;

  const build = (vendorDir: string) =>
    buildContent({ vendorDir, contentDir, loaders: [items], meta: {} });

  const open = () => new Database(resolveContentDb(contentDir), { readonly: true });

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "content-items-"));
    contentDir = join(workspace, "data", "content");
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
      .all() as { name: string; source: string }[];
    db.close();

    // The items the advantage mapping names, and the parent a mapped copy needs, are checked in
    // item-advantage.test.ts.
    const own = rows.filter(
      ({ name, source }) =>
        !MAPPED.has(`${name}|${source}`) && `${name}|${source}` !== "Dread Helm|XDMG",
    );
    expect(own).toEqual([
      row("Alchemist's Supplies", "PHB", "classic", "baseitem", "AT", "none", 0),
      row("Longsword", "PHB", "classic", "baseitem", "M", "none", 0),
      row("Longbow", "XPHB", "one", "baseitem", "R|XPHB", "none", 0),
      row("Longsword", "XPHB", "one", "baseitem", "M|XPHB", "none", 0),
      row("Orb", "XPHB", "one", "baseitem", "SCF|XPHB", "none", 0),
      row("Staff", "XPHB", "one", "baseitem", "SCF|XPHB", "none", 0),
      row("Wand", "XPHB", "one", "baseitem", "SCF|XPHB", "none", 0),
      row("+1 Wand of the War Mage", "DMG", "classic", "item", "WD|DMG", "uncommon", 1),
      row("Bag of Holding", "DMG", "classic", "item", null, "uncommon", 0),
      row("Wand of Magic Missiles", "DMG", "classic", "item", "WD|DMG", "uncommon", 0),
      row("Ascendant Dragon Vessel", "FTD", "classic", "item", null, "legendary", 1),
      row("Slumbering Dragon Vessel", "FTD", "classic", "item", null, "uncommon", 1),
      row("Stirring Dragon Vessel", "FTD", "classic", "item", null, "rare", 1),
      row("Wakened Dragon Vessel", "FTD", "classic", "item", null, "very rare", 1),
      row("Borderlands Tabard", "HotB", "one", "item", "G|XPHB", "none", 0),
      row("Dragon Thighbone Club", "SKT", "classic", "item", "M", "unknown (magic)", 0),
      row("Acid Absorbing Tattoo", "TCE", "classic", "item", null, null, 0),
      row("Charred Wand of Magic Missiles", "WDH", "classic", "item", "WD|DMG", "uncommon", 0),
      row("Cloak of Billowing", "XDMG", "one", "item", null, "common", 0),
      row("Arcane Focus", "PHB", "classic", "itemGroup", "SCF", "none", 0),
      row("Vicious +1 Weapon", "AI", "classic", "magicvariant", null, "unknown (magic)", 0),
      row("Armor of Acid Resistance", "DMG", "classic", "magicvariant", null, "rare", 1),
      row("Arrow of Slaying (*)", "DMG", "classic", "magicvariant", null, "very rare", 0),
      row("Vicious Weapon", "DMG", "classic", "magicvariant", null, "rare", 0),
      row("Armblade", "ERLW", "classic", "magicvariant", null, "common", 1),
      row("Imbued Wood (Fernian Ash)", "ERLW", "classic", "magicvariant", null, "common", 1),
      row("Ammunition of Slaying", "XDMG", "one", "magicvariant", null, "very rare", 0),
    ]);
  });

  it("folds a matching fluff entry into json by (name, source), across kinds", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const fluffOf = (name: string, source: string) =>
      JSON.parse(
        db
          .prepare("SELECT json FROM items WHERE name = ? AND source = ?")
          .pluck()
          .get(name, source) as string,
      ) as { fluff?: unknown };

    // An item, a base item and a magic variant, one fluff pool for all three.
    const wand = fluffOf("Wand of Magic Missiles", "DMG");
    const longswordPHB = fluffOf("Longsword", "PHB");
    const longswordXPHB = fluffOf("Longsword", "XPHB");
    const armblade = fluffOf("Armblade", "ERLW");
    db.close();

    expect(wand).toHaveProperty("fluff.images");
    expect(longswordPHB.fluff).toBeUndefined();
    expect(longswordXPHB).toHaveProperty("fluff.images");
    expect(armblade).toHaveProperty("fluff.images");
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
        "SELECT source, edition FROM items WHERE name IN ('Borderlands Tabard', 'Cloak of Billowing') AND source IN ('HotB', 'WttHC') ORDER BY source",
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

  it("leaves no {#itemEntry} reference in any row", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const left = db.prepare("SELECT name FROM items WHERE json LIKE '%{#itemEntry%'").all();
    db.close();

    expect(left).toEqual([]);
  });

  it("fills an item's template from the item's own fields", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const json = (name: string) =>
      db.prepare("SELECT json FROM items WHERE name = ?").pluck().get(name) as string;
    const tattoo = json("Acid Absorbing Tattoo");
    const armor = JSON.parse(json("Armor of Acid Resistance")) as {
      inherits: { entries: unknown };
    };
    db.close();

    expect(tattoo).toContain("Elided. acid Elided.");
    expect(tattoo).toContain("Elided. green Elided.");
    expect(tattoo).not.toContain("{{");
    // The reference names no source, so it reads the variant's own, DMG.
    expect(armor.inherits.entries).toEqual(["Elided. acid Elided."]);
  });

  describe("an {#itemEntry} reference", () => {
    const entriesOf = (item: Record<string, unknown>, template?: Record<string, unknown>) => {
      const files = {
        "data/items.json": { item: [{ name: "Charm", source: "DMG", ...item }], itemGroup: [] },
        ...(template && { "data/items-base.json": { baseitem: [], itemEntry: [template] } }),
      };
      build(vendorHolding(files));
      const db = open();
      const json = db.prepare("SELECT json FROM items").pluck().get() as string;
      db.close();
      return (JSON.parse(json) as { entries: unknown }).entries;
    };

    it("reads as its name where no template answers it", () => {
      expect(entriesOf({ entries: ["{#itemEntry Nothing|DMG}", "kept"] })).toEqual([
        "Nothing",
        "kept",
      ]);
    });

    it("names a placeholder's field where the item lacks it, and joins a list", () => {
      const template = {
        name: "Charm",
        source: "DMG",
        entriesTemplate: ["{{item.resist}} {{getFullImmRes item.missingField}} {{item.detail1}}"],
      };
      expect(
        entriesOf({ resist: ["acid", "cold", "fire"], entries: ["{#itemEntry Charm}"] }, template),
      ).toEqual(["acid, cold, and fire missing field detail1"]);
    });
  });

  const LONGSWORD = { name: "Longsword", source: "PHB", type: "M", rarity: "none" };

  const vendorHolding = (files: Record<string, unknown>): string => {
    const vendorDir = join(workspace, "vendor");
    for (const [path, contents] of Object.entries({
      "data/items.json": { item: [], itemGroup: [] },
      "data/items-base.json": { baseitem: [] },
      "data/magicvariants.json": { magicvariant: [] },
      "data/fluff-items.json": { itemFluff: [] },
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

  describe("an item group's replication", () => {
    const REPLICATE = "replicate magic item|artificer|efa|2|efa";
    const group = {
      name: "Armor of Resistance",
      source: "XDMG",
      classFeatures: [REPLICATE],
      optionalfeatures: null,
      items: ["Armor of Acid Resistance|XDMG", "Cloak of Charm|XDMG"],
    };

    const jsonOf = (files: Record<string, unknown>, name: string) => {
      build(vendorHolding(files));
      const db = open();
      const json = db.prepare("SELECT json FROM items WHERE name = ?").pluck().get(name) as string;
      db.close();
      return JSON.parse(json) as Record<string, unknown>;
    };

    const variant = (inherits: Record<string, unknown> = {}) => ({
      name: "Armor of Acid Resistance",
      type: "GV|XDMG",
      requires: [{ armor: true }],
      inherits: { source: "XDMG", rarity: "rare", entries: ["Resist."], ...inherits },
    });

    const note = "{@classFeature replicate magic item|artificer|efa|2|efa|Replicate Magic Item}";

    it("tells a member of the group an Artificer can replicate it, once", () => {
      const row = jsonOf(
        {
          "data/items.json": { item: [], itemGroup: [group] },
          "data/magicvariants.json": { magicvariant: [variant()] },
        },
        "Armor of Acid Resistance",
      );

      expect(itemEntries(row.inherits as Record<string, unknown>)).toEqual([
        "Resist.",
        `An Artificer can replicate this item with ${note}.`,
      ]);
    });

    it("reaches a plain item the group lists", () => {
      const row = jsonOf(
        {
          "data/items.json": {
            item: [{ name: "Cloak of Charm", source: "XDMG", entries: ["Charming."] }],
            itemGroup: [group],
          },
        },
        "Cloak of Charm",
      );

      expect(itemEntries(row)).toEqual([
        "Charming.",
        `An Artificer can replicate this item with ${note}.`,
      ]);
    });

    it("leaves a field the member states itself as the member wrote it", () => {
      const own = "replicate magic item|artificer|efa|3|efa";
      const row = jsonOf(
        {
          "data/items.json": { item: [], itemGroup: [group] },
          "data/magicvariants.json": { magicvariant: [variant({ classFeatures: [own] })] },
        },
        "Armor of Acid Resistance",
      );

      expect((row.inherits as { classFeatures: string[] }).classFeatures).toEqual([own]);
    });
  });

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
