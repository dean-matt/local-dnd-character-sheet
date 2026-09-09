import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildContent } from "../build-db.ts";
import { classes } from "./classes.ts";
import { EDITION_FILES } from "./edition.ts";

const FIXTURE_VENDOR = join(import.meta.dirname, "../../../../tests/fixtures/5etools");

describe("the classes loader", () => {
  let workspace: string;
  let dbPath: string;

  const build = (vendorDir: string) =>
    buildContent({ vendorDir, dbPath, loaders: [classes], meta: {} });

  const open = () => new Database(dbPath, { readonly: true });

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "content-classes-"));
    dbPath = join(workspace, "data", "content.db");
  });

  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  it("keys a class by (name, source) and takes the edition the entry declares", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rows = db
      .prepare("SELECT name, source, edition, hit_die FROM classes ORDER BY name, source")
      .all();
    db.close();

    expect(rows).toEqual([
      { name: "Cleric", source: "PHB", edition: "classic", hit_die: 8 },
      { name: "Cleric", source: "XPHB", edition: "one", hit_die: 8 },
      { name: "Fighter", source: "XPHB", edition: "one", hit_die: 10 },
      { name: "Warlock", source: "PHB", edition: "classic", hit_die: 8 },
    ]);
  });

  it("carries a subclass under its class, and falls back to the source for an edition", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rows = db
      .prepare(
        "SELECT name, source, class_name, class_source, edition FROM subclasses ORDER BY class_name, name, class_source",
      )
      .all();
    db.close();

    expect(rows).toEqual([
      // Neither Knowledge Domain entry declares an edition, so PHB and XPHB
      // decide it — the same subclass, filed under each edition of its class.
      {
        name: "Knowledge Domain",
        source: "PHB",
        class_name: "Cleric",
        class_source: "PHB",
        edition: "classic",
      },
      {
        name: "Knowledge Domain",
        source: "PHB",
        class_name: "Cleric",
        class_source: "XPHB",
        edition: "classic",
      },
      {
        name: "Eldritch Knight",
        source: "XPHB",
        class_name: "Fighter",
        class_source: "XPHB",
        edition: "one",
      },
      {
        name: "Psi Warrior",
        source: "XPHB",
        class_name: "Fighter",
        class_source: "XPHB",
        edition: "one",
      },
    ]);
  });

  it("skips the sidekicks, which carry no hit die to store", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const sidekicks = db
      .prepare("SELECT COUNT(*) FROM classes WHERE name LIKE '%Sidekick'")
      .pluck()
      .get();
    db.close();

    expect(sidekicks).toBe(0);
  });

  it("maps a known column label to a pinned key and slugs the rest", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rows = db
      .prepare(
        "SELECT level, resource_key, value FROM class_resources WHERE class_name = 'Cleric' AND class_source = 'PHB' ORDER BY level, resource_key",
      )
      .all();
    db.close();

    expect(rows).toEqual([
      // Level 1 has no Channel Divinity: a zero cell stores no row at all.
      { level: 1, resource_key: "cantrips_known", value: "3" },
      { level: 2, resource_key: "cantrips_known", value: "3" },
      { level: 2, resource_key: "channel_divinity", value: "1" },
      { level: 3, resource_key: "cantrips_known", value: "3" },
      { level: 3, resource_key: "channel_divinity", value: "1" },
      { level: 4, resource_key: "cantrips_known", value: "4" },
      { level: 4, resource_key: "channel_divinity", value: "1" },
      { level: 5, resource_key: "cantrips_known", value: "4" },
      { level: 5, resource_key: "channel_divinity", value: "2" },
    ]);
  });

  it("pins a renamed column to the key its other edition uses", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const keys = db
      .prepare(
        "SELECT DISTINCT class_source, resource_key FROM class_resources WHERE class_name = 'Cleric' AND resource_key LIKE 'cantrips%' ORDER BY class_source",
      )
      .all();
    db.close();

    // PHB labels the column "Cantrips Known" and XPHB labels it "Cantrips".
    expect(keys).toEqual([
      { class_source: "PHB", resource_key: "cantrips_known" },
      { class_source: "XPHB", resource_key: "cantrips_known" },
    ]);
  });

  it("reads a column of a rowsSpellProgression as a slot level, omitting the zeros", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rows = db
      .prepare(
        "SELECT level, slot_level, slots FROM spell_slots WHERE class_name = 'Cleric' AND class_source = 'XPHB' ORDER BY level, slot_level",
      )
      .all();
    db.close();

    expect(rows).toEqual([
      { level: 1, slot_level: 1, slots: 2 },
      { level: 2, slot_level: 1, slots: 3 },
      { level: 3, slot_level: 1, slots: 4 },
      { level: 3, slot_level: 2, slots: 2 },
      { level: 4, slot_level: 1, slots: 4 },
      { level: 4, slot_level: 2, slots: 3 },
      { level: 5, slot_level: 1, slots: 4 },
      { level: 5, slot_level: 2, slots: 3 },
    ]);
  });

  it("stores pact magic from its own two columns, and neither as a resource", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const slots = db
      .prepare(
        "SELECT level, slot_level, slots FROM spell_slots WHERE class_name = 'Warlock' ORDER BY level",
      )
      .all();
    const keys = db
      .prepare(
        "SELECT DISTINCT resource_key FROM class_resources WHERE class_name = 'Warlock' ORDER BY resource_key",
      )
      .pluck()
      .all();
    db.close();

    expect(slots).toEqual([
      { level: 1, slot_level: 1, slots: 1 },
      { level: 2, slot_level: 1, slots: 2 },
      { level: 3, slot_level: 2, slots: 2 },
    ]);
    expect(keys).toEqual(["cantrips_known", "invocations_known"]);
  });

  it("files a subclass table under the subclass, tag labels and all", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const resources = db
      .prepare(
        "SELECT subclass_name, level, resource_key, value FROM subclass_resources ORDER BY subclass_name, level, resource_key",
      )
      .all();
    const slots = db
      .prepare(
        "SELECT subclass_name, level, slot_level, slots FROM subclass_spell_slots ORDER BY level, slot_level",
      )
      .all();
    db.close();

    expect(resources).toEqual([
      { subclass_name: "Eldritch Knight", level: 3, resource_key: "prepared_spells", value: "3" },
      { subclass_name: "Eldritch Knight", level: 4, resource_key: "prepared_spells", value: "4" },
      { subclass_name: "Eldritch Knight", level: 5, resource_key: "prepared_spells", value: "4" },
      // The Die Size label pins to the energy die its tip names, and a dice
      // cell stores the text upstream shows.
      { subclass_name: "Psi Warrior", level: 3, resource_key: "energy_die_number", value: "4" },
      { subclass_name: "Psi Warrior", level: 3, resource_key: "energy_die_size", value: "D6" },
      { subclass_name: "Psi Warrior", level: 4, resource_key: "energy_die_number", value: "4" },
      { subclass_name: "Psi Warrior", level: 4, resource_key: "energy_die_size", value: "D6" },
      { subclass_name: "Psi Warrior", level: 5, resource_key: "energy_die_number", value: "6" },
      { subclass_name: "Psi Warrior", level: 5, resource_key: "energy_die_size", value: "D8" },
    ]);
    expect(slots).toEqual([
      { subclass_name: "Eldritch Knight", level: 3, slot_level: 1, slots: 2 },
      { subclass_name: "Eldritch Knight", level: 4, slot_level: 1, slots: 3 },
      { subclass_name: "Eldritch Knight", level: 5, slot_level: 1, slots: 3 },
    ]);
  });

  const vendorHolding = (file: string, contents: unknown): string => {
    const vendorDir = join(workspace, "vendor");
    mkdirSync(join(vendorDir, "data", "class"), { recursive: true });
    writeFileSync(join(vendorDir, "data", "class", file), JSON.stringify(contents));
    for (const path of EDITION_FILES) {
      const destination = join(vendorDir, path);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(join(FIXTURE_VENDOR, path), destination);
    }
    return vendorDir;
  };

  /**
   * The reason, not the wrapper. `buildContent` reports every failure as
   * `Loader "classes" failed`, including a vendor directory missing a file the
   * loader declared, so asserting the wrapper passes whether or not the entry
   * was refused for the stated reason.
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

  const barbarian = (rows: unknown[][], colLabels: string[]) => ({
    class: [
      {
        name: "Barbarian",
        source: "PHB",
        edition: "classic",
        hd: { number: 1, faces: 12 },
        classTableGroups: [{ colLabels, rows }],
      },
    ],
  });

  const resourcesIn = (vendorDir: string) => {
    build(vendorDir);
    const db = open();
    const rows = db
      .prepare("SELECT level, resource_key, value FROM class_resources ORDER BY level")
      .all();
    db.close();
    return rows;
  };

  it.each([
    ["a count", 3, "3"],
    ["a numeric string", "3", "3"],
    ["an unlimited resource", "Unlimited", "Unlimited"],
    ["a bonus", { type: "bonus", value: 2 }, "+2"],
    ["a speed bonus", { type: "bonusSpeed", value: 10 }, "+10 ft."],
    ["a die", { type: "dice", rollable: true, toRoll: [{ number: 2, faces: 6 }] }, "2d6"],
    ["a tagged die", "{@dice D8}", "D8"],
  ])("stores %s as the text upstream shows", (_case, cell, stored) => {
    expect(
      resourcesIn(vendorHolding("class-barbarian.json", barbarian([[cell]], ["Rages"]))),
    ).toEqual([{ level: 1, resource_key: "rages", value: stored }]);
  });

  it.each([
    ["an em dash", "—"],
    ["a zero", 0],
    ["a zero bonus", { type: "bonus", value: 0 }],
    ["a zero speed bonus", { type: "bonusSpeed", value: 0 }],
  ])("stores no row for %s, so an absent row means none", (_case, cell) => {
    expect(
      resourcesIn(vendorHolding("class-barbarian.json", barbarian([[cell]], ["Rages"]))),
    ).toEqual([]);
  });

  it("refuses a cell shape it cannot read rather than storing a guess", () => {
    expect(
      refusal(
        vendorHolding("class-barbarian.json", barbarian([[{ type: "elephant" }]], ["Rages"])),
      ),
    ).toMatch(/is not a value this loader reads/);
  });

  it("refuses a bonus carrying no number rather than storing the word undefined", () => {
    expect(
      refusal(vendorHolding("class-barbarian.json", barbarian([[{ type: "bonus" }]], ["Rages"]))),
    ).toMatch(/bonus undefined is not a number/);
  });

  it("refuses a spell progression whose columns are not labelled from the first level", () => {
    const contents = {
      class: [
        {
          name: "Barbarian",
          source: "PHB",
          edition: "classic",
          hd: { number: 1, faces: 12 },
          classTableGroups: [
            {
              title: "Spell Slots per Spell Level",
              colLabels: ["{@filter 2nd|spells|level=2}", "{@filter 3rd|spells|level=3}"],
              rowsSpellProgression: [[2, 0]],
            },
          ],
        },
      ],
    };

    expect(refusal(vendorHolding("class-barbarian.json", contents))).toMatch(
      /column 1 is labelled for slot level 2/,
    );
  });

  it("refuses a Spell Slots column without the Slot Level that names its level", () => {
    expect(
      refusal(vendorHolding("class-barbarian.json", barbarian([[2]], ["Spell Slots"]))),
    ).toMatch(/"Spell Slots" and "Slot Level" come as a pair/);
  });

  it("refuses a subclass table group that names another subclass", () => {
    const contents = {
      subclass: [
        {
          name: "Psi Warrior",
          shortName: "Psi Warrior",
          source: "XPHB",
          className: "Fighter",
          classSource: "XPHB",
          subclassTableGroups: [
            {
              subclasses: [{ name: "Soulknife", source: "XPHB" }],
              colLabels: ["Number"],
              rows: [[4]],
            },
          ],
        },
      ],
    };

    expect(refusal(vendorHolding("class-fighter.json", contents))).toMatch(
      /a table group names .*Soulknife.*, not its owner/,
    );
  });
});
