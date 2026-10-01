import { describe, expect, it } from "vitest";
import { classesWorkspace, FIXTURE_VENDOR, table } from "../test/class-vendor.ts";

describe("the class, subclass and feature rows", () => {
  const { build, open, vendorHolding, refusal } = classesWorkspace();

  it("keys a class by (name, source) and takes the edition the entry declares", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rows = db
      .prepare("SELECT name, source, edition, hit_die FROM classes ORDER BY name, source")
      .all();
    db.close();

    expect(rows).toEqual([
      { name: "Artificer", source: "TCE", edition: "classic", hit_die: 8 },
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
        "SELECT name, source, short_name, class_name, class_source, edition FROM subclasses " +
          "ORDER BY class_name, name, class_source",
      )
      .all() as Record<string, string>[];
    db.close();

    // Knowledge Domain declares no edition, so PHB decides it; Death Domain
    // declares one and its XPHB variant inherits that through _copy. Either way
    // the subclass is filed under each edition of its class rather than moved.
    // short_name is what a tag and a subclass_features row call it.
    expect(
      rows.map(
        ({ name, source, short_name, class_name, class_source, edition }) =>
          `${name}|${source} (${short_name}) ${class_name}|${class_source} ${edition}`,
      ),
    ).toEqual([
      "Death Domain|DMG (Death) Cleric|PHB classic",
      "Death Domain|DMG (Death) Cleric|XPHB classic",
      "Knowledge Domain|PHB (Knowledge) Cleric|PHB classic",
      "Knowledge Domain|PHB (Knowledge) Cleric|XPHB classic",
      "Battle Master|XPHB (Battle Master) Fighter|XPHB one",
      "Eldritch Knight|XPHB (Eldritch Knight) Fighter|XPHB one",
      "Psi Warrior|XPHB (Psi Warrior) Fighter|XPHB one",
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

  it("keys a class feature by its class and level, not by name and source", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rows = db
      .prepare(
        "SELECT name, source, class_name, class_source, level, edition FROM class_features " +
          "ORDER BY source, class_name, level",
      )
      .all() as Record<string, string | number>[];
    db.close();

    expect(
      rows.map(
        ({ name, source, class_name, class_source, level, edition }) =>
          `${name}|${source} ${class_name}|${class_source} ${level} ${edition}`,
      ),
    ).toEqual([
      "Ability Score Improvement|PHB Cleric|PHB 4 classic",
      "Ability Score Improvement|PHB Cleric|PHB 8 classic",
      "Ability Score Improvement|XPHB Cleric|XPHB 4 one",
      "Ability Score Improvement|XPHB Fighter|XPHB 4 one",
    ]);
  });

  it("carries the subclass short name a feature and a tag both use", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rows = db
      .prepare(
        "SELECT s.name, s.short_name, s.class_source, f.level, COUNT(f.name) AS features " +
          "FROM subclasses s JOIN subclass_features f ON f.subclass_short_name = s.short_name " +
          "AND f.subclass_source = s.source AND f.class_name = s.class_name " +
          "AND f.class_source = s.class_source " +
          "GROUP BY s.name, s.short_name, s.class_source, f.level ORDER BY s.class_source",
      )
      .all();
    db.close();

    // The 2014 Cleric gains the feature at 2 and the 2024 one at 3, so a join
    // that lost class_source would file both under whichever came first.
    expect(rows).toEqual([
      { name: "Death Domain", short_name: "Death", class_source: "PHB", level: 2, features: 1 },
      { name: "Death Domain", short_name: "Death", class_source: "XPHB", level: 3, features: 1 },
    ]);
  });

  it("keeps a sidekick's features out, since no row holds the class that grants them", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const orphans = db
      .prepare(
        "SELECT COUNT(*) FROM class_features f WHERE NOT EXISTS " +
          "(SELECT 1 FROM classes c WHERE c.name = f.class_name AND c.source = f.class_source)",
      )
      .pluck()
      .get();
    db.close();

    expect(orphans).toBe(0);
  });

  it("separates two subclass features that share a name and source", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rows = db
      .prepare(
        "SELECT class_source, subclass_short_name, subclass_source, level FROM subclass_features " +
          "WHERE name = ? AND source = ? ORDER BY level",
      )
      .all("Channel Divinity: Touch of Death", "DMG");
    db.close();

    expect(rows).toEqual([
      { class_source: "PHB", subclass_short_name: "Death", subclass_source: "DMG", level: 2 },
      { class_source: "XPHB", subclass_short_name: "Death", subclass_source: "DMG", level: 3 },
    ]);
  });

  const ASI = {
    name: "Ability Score Improvement",
    source: "PHB",
    className: "Fighter",
    classSource: "PHB",
    level: 4,
    entries: ["Elided."],
  };

  /** A feature is refused unless its class has a row, so one comes along. */
  const granting = (...classFeature: unknown[]) => ({
    class: [{ name: "Fighter", source: "PHB", hd: { number: 1, faces: 10 } }],
    classFeature,
  });

  it("fails the build when two features share their whole key", () => {
    expect(refusal(vendorHolding("class-fighter.json", granting(ASI, ASI)))).toMatch(
      /UNIQUE constraint failed: class_features\./,
    );
  });

  it("keeps two features of one class apart by level", () => {
    build(vendorHolding("class-fighter.json", granting(ASI, { ...ASI, level: 6 })));

    const db = open();
    const levels = db.prepare("SELECT level FROM class_features ORDER BY level").pluck().all();
    db.close();

    expect(levels).toEqual([4, 6]);
  });

  it("refuses a feature whose class has no row, since no query would ever return it", () => {
    expect(refusal(vendorHolding("class-fighter.json", { classFeature: [ASI] }))).toMatch(
      /class-fighter\.json classFeature\[0\]: Ability Score Improvement names class Fighter\|PHB, which no row holds/,
    );
  });

  it.each([
    ["no className", { className: undefined }, /className is missing or not a string/],
    ["no level", { level: undefined }, /level undefined is not a whole number from 1 to 20/],
    ["a level of 0", { level: 0 }, /level 0 is not a whole number from 1 to 20/],
    ["a level past 20", { level: 21 }, /level 21 is not a whole number from 1 to 20/],
  ])("refuses a feature with %s", (_, override, reason) => {
    expect(refusal(vendorHolding("class-fighter.json", granting({ ...ASI, ...override })))).toMatch(
      reason,
    );
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
              rows: table(4),
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
