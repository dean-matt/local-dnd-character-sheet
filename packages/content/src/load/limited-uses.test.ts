import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildContent, resolveContentDb } from "../build-db.ts";
import { characterOptions } from "./character-options.ts";
import { classes } from "./classes.ts";
import { limitedUses, traitUses } from "./limited-uses.ts";
import { races } from "./races.ts";

const FIXTURE_VENDOR = join(import.meta.dirname, "../../../../tests/fixtures/5etools");
const VENDOR = join(import.meta.dirname, "../../../../vendor/5etools");

describe("limitedUses", () => {
  it.each([
    ["Once you do, you can't use it again until you finish a long rest.", 1, "long"],
    ["Once you do, you can't do so again until you finish a Short Rest or Long Rest.", 1, "short"],
    ["Then you must finish a short or long rest before you can use it again.", 1, "short"],
    [
      "You can use it three times, and you regain all expended uses when you finish a long rest.",
      3,
      "long",
    ],
    [
      "You can use this feature twice. You regain all expended uses when you finish a Short Rest.",
      2,
      "short",
    ],
    ["You can't do so again until you finish a {@variantrule Long Rest|XPHB}.", 1, "long"],
  ])("reads %j", (sentence, uses, reset) => {
    expect(limitedUses([sentence])).toEqual({ uses, reset });
  });

  it("reads a sentence nested in a list", () => {
    const entries = [
      { type: "list", items: ["You can't use it again until you finish a long rest."] },
    ];
    expect(limitedUses(entries)).toEqual({ uses: 1, reset: "long" });
  });

  it.each([
    ["no count", ["You gain proficiency with heavy armor."]],
    ["no reset", ["You can use it twice on each of your turns."]],
    [
      "a count that grows",
      [
        "You can't use it again until you finish a long rest.",
        "At 17th level, you can use it twice before a rest.",
      ],
    ],
    [
      "a partial reset",
      [
        "You can use it twice. You regain one expended use when you finish a short rest, and all of them when you finish a long rest.",
      ],
    ],
    [
      "a count from a modifier",
      [
        "You can do so a number of times equal to your Wisdom modifier, and you regain all expended uses when you finish a long rest.",
      ],
    ],
    [
      "a count from the class level",
      [
        "The number of times you can use this feature is based on the level you've reached in this class: 2nd level, once; 6th level, twice; and 18th level, thrice. You regain all expended uses when you finish a long rest.",
      ],
    ],
    [
      "a die pool with a partial reset",
      [
        "You regain all your expended Psionic Energy dice when you finish a long rest. In addition, as a bonus action, you can regain one expended Psionic Energy die, but you can't do so again until you finish a short or long rest.",
      ],
    ],
    [
      "a count for each spell",
      [
        "You can cast each of them once at 3rd level without expending a spell slot. When you do so, you can't do so again until you finish a short or long rest.",
      ],
    ],
    [
      "a limit in each of two named parts",
      [
        "Your Replicate Magic Item feature gains the following options.",
        {
          type: "entries",
          name: "Drain Magic Item",
          entries: [
            "Once you use this feature, you can't do so again until you finish a long rest.",
          ],
        },
        {
          type: "entries",
          name: "Transmute Magic Item",
          entries: [
            "Once you use this feature, you can't do so again until you finish a long rest.",
          ],
        },
      ],
    ],
    [
      "two resets",
      [
        "You can't use it again until you finish a long rest.",
        "You can't do so again until you finish a short rest.",
      ],
    ],
  ])("yields nothing for %s", (_, entries) => {
    expect(limitedUses(entries)).toBeUndefined();
  });

  it("does not throw on entries that are not prose", () => {
    expect(limitedUses(undefined)).toBeUndefined();
    expect(limitedUses([{ type: "table", rows: [[1, 2]] }, 7, null])).toBeUndefined();
  });
});

describe("traitUses", () => {
  const trait = (name: string, text: string) => ({ type: "entries", name, entries: [text] });
  const limited = "You can't use it again until you finish a long rest.";

  it("maps each trait with limited uses by name", () => {
    const entries = [trait("Darkvision", "You see in the dark."), trait("Endure", limited)];
    expect(JSON.parse(traitUses(entries) ?? "null")).toEqual({
      Endure: { uses: 1, reset: "long" },
    });
  });

  it("is null where no trait has any, and drops a name two traits share", () => {
    expect(traitUses([trait("Darkvision", "You see in the dark.")])).toBeNull();
    expect(traitUses([trait("Endure", limited), trait("Endure", limited)])).toBeNull();
  });
});

describe("the limited-uses columns", () => {
  let workspace = "";
  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "content-uses-"));
  });
  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  const built = (vendorDir: string) => {
    const contentDir = join(workspace, "data", "content");
    buildContent({ vendorDir, contentDir, loaders: [classes, races, characterOptions], meta: {} });
    return new Database(resolveContentDb(contentDir), { readonly: true });
  };

  const featureUses = (db: Database.Database, table: string, where: string, ...args: unknown[]) =>
    db.prepare(`SELECT uses, uses_reset FROM ${table} WHERE ${where}`).all(...args);

  it("holds the uses a fixture feature's text states, and none where it is elided", () => {
    const db = built(FIXTURE_VENDOR);
    try {
      expect(
        featureUses(
          db,
          "subclass_features",
          "name = ? AND class_source = ?",
          "Channel Divinity: Touch of Death",
          "PHB",
        ),
      ).toEqual([{ uses: 2, uses_reset: "long" }]);
      expect(
        featureUses(
          db,
          "subclass_features",
          "name = ? AND subclass_short_name = ?",
          "Storm Aura",
          "Storm Herald",
        ),
      ).toEqual([{ uses: null, uses_reset: null }]);
      const race = db.prepare("SELECT trait_uses FROM races WHERE name = ? AND source = ?");
      expect(
        JSON.parse((race.get("Aasimar", "MPMM") as { trait_uses: string }).trait_uses),
      ).toEqual({
        "Healing Hands": { uses: 1, reset: "long" },
      });
    } finally {
      db.close();
    }
  });

  describe.skipIf(!existsSync(join(VENDOR, "data/races.json")))("against vendor/", () => {
    it("reads the features whose uses the printed text fixes, and leaves the rest", () => {
      const db = built(VENDOR);
      try {
        const classFeature = (name: string, source: string, level: number) =>
          featureUses(
            db,
            "class_features",
            "name = ? AND source = ? AND level = ?",
            name,
            source,
            level,
          );
        expect(classFeature("Second Wind", "PHB", 1)).toEqual([{ uses: 1, uses_reset: "short" }]);
        expect(classFeature("Innate Sorcery", "XPHB", 1)).toEqual([
          { uses: 2, uses_reset: "long" },
        ]);
        // Twice from 17th level, and Second Wind's count comes from the class table.
        expect(classFeature("Action Surge", "PHB", 2)).toEqual([{ uses: null, uses_reset: null }]);
        expect(classFeature("Second Wind", "XPHB", 1)).toEqual([{ uses: null, uses_reset: null }]);
        expect(classFeature("Signature Spells", "PHB", 20)).toEqual([
          { uses: null, uses_reset: null },
        ]);
        expect(featureUses(db, "feats", "name = ? AND source = ?", "Mage Slayer", "XPHB")).toEqual([
          { uses: 1, uses_reset: "short" },
        ]);
        const race = db.prepare("SELECT trait_uses FROM races WHERE name = ? AND source = ?");
        expect(
          JSON.parse((race.get("Half-Orc", "PHB") as { trait_uses: string }).trait_uses),
        ).toEqual({
          "Relentless Endurance": { uses: 1, reset: "long" },
        });
      } finally {
        db.close();
      }
    });
  });
});
