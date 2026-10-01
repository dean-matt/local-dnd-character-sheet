import { describe, expect, it } from "vitest";
import { classesWorkspace, FIXTURE_VENDOR, table } from "../test/class-vendor.ts";

describe("the class table groups", () => {
  const { build, open, vendorHolding, refusal } = classesWorkspace();

  it("maps a known column label to a pinned key and slugs the rest", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rows = db
      .prepare(
        "SELECT level, resource_key, value FROM class_resources WHERE class_name = 'Cleric' AND class_source = 'XPHB' AND level <= 5 ORDER BY level, resource_key",
      )
      .all();
    db.close();

    expect(rows).toEqual([
      // Level 1 has no Channel Divinity: a zero cell stores no row at all.
      { level: 1, resource_key: "cantrips_known", value: "3" },
      { level: 2, resource_key: "cantrips_known", value: "3" },
      { level: 2, resource_key: "channel_divinity", value: "2" },
      { level: 3, resource_key: "cantrips_known", value: "3" },
      { level: 3, resource_key: "channel_divinity", value: "2" },
      { level: 4, resource_key: "cantrips_known", value: "4" },
      { level: 4, resource_key: "channel_divinity", value: "2" },
      { level: 5, resource_key: "cantrips_known", value: "4" },
      { level: 5, resource_key: "channel_divinity", value: "2" },
    ]);
  });

  it("stores a cell upstream ships as a string, which the Fighter's table does", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rows = db
      .prepare(
        "SELECT resource_key, value FROM class_resources WHERE class_name = 'Fighter' AND class_source = 'XPHB' AND level = 1 ORDER BY resource_key",
      )
      .all();
    db.close();

    expect(rows).toEqual([
      { resource_key: "second_wind", value: "2" },
      { resource_key: "weapon_mastery", value: "3" },
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
        "SELECT level, slot_level, slots FROM spell_slots WHERE class_name = 'Cleric' AND class_source = 'XPHB' AND level <= 5 ORDER BY level, slot_level",
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
        "SELECT level, slot_level, slots FROM spell_slots WHERE class_name = 'Warlock' AND level <= 3 ORDER BY level",
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
        "SELECT subclass_name, level, resource_key, value FROM subclass_resources WHERE level <= 5 ORDER BY subclass_name, level, resource_key",
      )
      .all();
    const slots = db
      .prepare(
        "SELECT subclass_name, level, slot_level, slots FROM subclass_spell_slots WHERE level <= 5 ORDER BY level, slot_level",
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
      resourcesIn(vendorHolding("class-barbarian.json", barbarian(table(cell), ["Rages"]))),
    ).toEqual([{ level: 1, resource_key: "rages", value: stored }]);
  });

  it.each([
    ["an em dash", "—"],
    ["a zero", 0],
    ["a zero bonus", { type: "bonus", value: 0 }],
    ["a zero speed bonus", { type: "bonusSpeed", value: 0 }],
  ])("stores no row for %s, so an absent row means none", (_case, cell) => {
    expect(
      resourcesIn(vendorHolding("class-barbarian.json", barbarian(table(cell), ["Rages"]))),
    ).toEqual([]);
  });

  it("refuses a cell shape it cannot read rather than storing a guess", () => {
    expect(
      refusal(
        vendorHolding("class-barbarian.json", barbarian(table({ type: "elephant" }), ["Rages"])),
      ),
    ).toMatch(/is not a value this loader reads/);
  });

  it("refuses a bonus carrying no number rather than storing the word undefined", () => {
    expect(
      refusal(
        vendorHolding("class-barbarian.json", barbarian(table({ type: "bonus" }), ["Rages"])),
      ),
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
              rowsSpellProgression: table(2, 0),
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
      refusal(vendorHolding("class-barbarian.json", barbarian(table(2), ["Spell Slots"]))),
    ).toMatch(/"Spell Slots" and "Slot Level" come as a pair/);
  });
});
