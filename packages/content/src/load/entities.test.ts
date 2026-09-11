import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildContent } from "../build-db.ts";
import { entityLoaders } from "./entities.ts";

const FIXTURE_VENDOR = join(import.meta.dirname, "../../../../tests/fixtures/5etools");

type Identity = {
  type: string;
  name: string;
  source: string;
  qualifier: string;
  edition: string | null;
};

describe("the Tier C entity loaders", () => {
  let workspace: string;
  let dbPath: string;

  const build = (vendorDir: string) =>
    buildContent({ vendorDir, dbPath, loaders: entityLoaders, meta: {} });

  const open = () => new Database(dbPath, { readonly: true });

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "content-entities-"));
    dbPath = join(workspace, "data", "content.db");
  });

  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  it("keys every type by (type, name, source, qualifier) with an edition per ruleset", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rows = db
      .prepare(
        "SELECT type, name, source, qualifier, edition FROM entities ORDER BY type, name, source, qualifier",
      )
      .all() as Identity[];
    db.close();

    expect(
      rows.map(
        ({ type, name, source, qualifier, edition }) =>
          `${type} ${name}|${source}${qualifier && `|${qualifier}`} ${edition}`,
      ),
    ).toEqual([
      "adventure Heroes of the Borderlands|HotB one",
      "adventure Lost Mine of Phandelver|LMoP classic",
      "adventure Stranger Things: Welcome to the Hellfire Club|WttHC one",
      "book Dungeon Master's Guide (2024)|XDMG one",
      "book Monster Manual (2025)|XMM one",
      "book Player's Handbook (2014)|PHB classic",
      "book Player's Handbook (2024)|XPHB one",
      "book Puncheons and Flagons|PaF classic",
      "boon Demonic Boon of Balor|MTF classic",
      "card Balance|BMT|Deck of Many More Things classic",
      "card Balance|BMT|Deck of Many Things classic",
      "charoption Anvilwrought|MOT classic",
      "crochetPattern Bag of Holding|CaBoMP classic",
      "cult Cult of Asmodeus|MTF classic",
      "deck Condition Cards|ESK classic",
      "encounter Arctic|XGE classic",
      "facility Ancient Altar|RHW classic",
      "facility Arcane Study|XDMG one",
      "hazard Avalanche|IDRotF classic",
      "legendaryGroup Aboleth|MM classic",
      "legendaryGroup Aboleth|XMM one",
      "monster Archmage|MM classic",
      "monster Archmage (Familiar)|MM classic",
      "monster Feonor|BGDIA classic",
      "monster Goblin|MM classic",
      "monster Goblin Warrior|XMM one",
      "name Dragonborn|XGE classic",
      "object Ballista|DMG classic",
      "recipe Almond Brandy|PaF classic",
      "reward Ancient Seal|VRGR classic",
      "reward Arcane Study Charm|XDMG one",
      "trap Bear Trap|XGE classic",
      "vehicle Apparatus of Kwalish|DMG classic",
      "vehicle Apparatus of Kwalish|XDMG one",
      "vehicleUpgrade Arcane Artillery|GoS classic",
    ]);
  });

  it("renders a tag to the words it displays and keeps the entry in json", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const row = db
      .prepare(
        "SELECT json, rendered_text FROM entities WHERE type = 'monster' AND name = 'Goblin'",
      )
      .get() as { json: string; rendered_text: string };
    db.close();

    // `{@atk mw}` and `{@h}` render as words no argument of theirs spells.
    expect(row.rendered_text).toContain("Melee Weapon Attack: +4 Elided. Hit:");
    expect(row.rendered_text).not.toContain("{@");
    expect(row.json).toContain("{@atk mw}");
  });

  it("indexes the words an entry holds and not the pointers beside them", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const read = (type: string, where: string, value: string) =>
      db
        .prepare(`SELECT json, rendered_text FROM entities WHERE type = ? AND ${where} = ?`)
        .get(type, value) as { json: string; rendered_text: string };
    const card = read("card", "qualifier", "Deck of Many Things");
    const goblin = read("monster", "name", "Goblin");
    db.close();

    // A card's art path, and the goblin's `scimitar|phb`, which answers a search for the
    // book rather than for anything the entry says.
    expect(card.json).toContain(".webp");
    expect(card.rendered_text).not.toContain(".webp");
    expect(goblin.json).toContain("scimitar|phb");
    expect(goblin.rendered_text).not.toContain("|phb");
    expect(goblin.rendered_text).not.toContain("goblin.opus");
    // The weapon is still searchable, because the action that swings it names it.
    expect(goblin.rendered_text).toContain("Scimitar");
  });

  it("answers a plain-word query against the index over both columns", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const matching = (query: string): string[] =>
      db
        .prepare(
          `SELECT e.type || ' ' || e.name FROM entities_fts
             JOIN entities e ON e.rowid = entities_fts.rowid
            WHERE entities_fts MATCH ? ORDER BY e.type, e.name`,
        )
        .pluck()
        .all(query) as string[];
    const byName = matching("goblin");
    const byText = matching("scimitar");
    db.close();

    expect(byName).toEqual(["monster Goblin", "monster Goblin Warrior"]);
    // No name holds "scimitar", so this reaches the row through rendered_text alone.
    expect(byText).toEqual(["monster Goblin", "monster Goblin Warrior"]);
  });

  it("holds an adventure and a book as one row each, the whole volume's text in it", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const lmop = db
      .prepare("SELECT json, rendered_text FROM entities WHERE type = 'adventure' AND source = ?")
      .get("LMoP") as { json: string; rendered_text: string };
    db.close();

    // The body file carries no name or source, so the row is the index entry and the
    // body is the text. The fixture elides the prose, leaving the chapter names it kept.
    expect(JSON.parse(lmop.json)).toMatchObject({ id: "LMoP", published: "2014-07-15" });
    expect(lmop.rendered_text).toContain("Introduction");
  });

  it("tells two cards of a name apart by the deck each belongs to", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const decks = db
      .prepare("SELECT qualifier FROM entities WHERE type = 'card' AND name = ? ORDER BY qualifier")
      .pluck()
      .all("Balance") as string[];
    db.close();

    expect(decks).toEqual(["Deck of Many More Things", "Deck of Many Things"]);
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

  it("refuses a card with no deck, which is the fourth part of its key", () => {
    expect(
      refusal(
        vendorHolding("data/decks.json", { deck: [], card: [{ name: "Balance", source: "BMT" }] }),
      ),
    ).toMatch(/data\/decks\.json card\[0\]: set is missing or not a string/);
  });

  it("refuses an index entry whose volume has no body file", () => {
    expect(
      refusal(
        vendorHolding("data/adventures.json", {
          adventure: [{ name: "Nowhere", id: "NWH", source: "NWH" }],
        }),
      ),
    ).toMatch(/NWH has no body at data\/adventure\/adventure-nwh\.json/);
  });
});
