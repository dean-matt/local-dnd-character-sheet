import { describe, expect, it } from "vitest";
import { elide, select } from "./select.ts";

const upstream = {
  spell: [
    { name: "Acid Splash", source: "PHB", page: 211, level: 0, entries: ["Prose."] },
    { name: "Detect Magic", source: "PHB", page: 231, level: 1, entries: ["Prose."] },
  ],
};

describe("select", () => {
  it("keeps the entries the declaration names, in the order it names them", () => {
    const kept = select(upstream, { within: { spell: { items: ["Detect Magic|PHB|1"] } } }, "$");

    expect(kept).toEqual({ spell: [{ ...upstream.spell[1], entries: ["Elided."] }] });
  });

  it("keeps the fields the declaration names, in upstream order", () => {
    const kept = select(
      upstream,
      { within: { spell: { items: [{ id: "Acid Splash|PHB|0", fields: ["level", "name"] }] } } },
      "$",
    );

    expect(Object.keys((kept as { spell: object[] }).spell[0] ?? {})).toEqual(["name", "level"]);
  });

  it("keeps the table columns the declaration names, and the cells under them", () => {
    const group = {
      colLabels: ["Rages", "Rage Damage", "Proficiency"],
      rows: [
        [2, "+2", "+2"],
        [3, "+2", "+2"],
      ],
    };

    expect(select(group, { cols: ["Proficiency", "Rages"] }, "$")).toEqual({
      colLabels: ["Rages", "Proficiency"],
      rows: [
        [2, "+2"],
        [3, "+2"],
      ],
    });
  });

  it("takes an override's value, and leaves its prose alone", () => {
    const kept = select(
      { entries: ["Prose."] },
      { set: { entries: { value: ["Kept."], why: "a test needs to read it" } } },
      "$",
    );

    expect(kept).toEqual({ entries: ["Kept."] });
  });

  it("refuses a field upstream does not carry, rather than writing a smaller fixture", () => {
    expect(() => select(upstream, { fields: ["spell", "monster"] }, "$")).toThrow(
      "$: upstream has no field monster",
    );
  });

  it("refuses an entry upstream does not carry", () => {
    expect(() =>
      select(upstream, { within: { spell: { items: ["Fireball|PHB|3"] } } }, "$"),
    ).toThrow('$.spell: upstream has no unclaimed element "Fireball|PHB|3"');
  });

  it("refuses a selection an array cannot answer, rather than ignoring it", () => {
    expect(() => select(upstream, { within: { spell: { fields: ["name"] } } }, "$")).toThrow(
      "$.spell: upstream holds an array, which fields cannot select",
    );
  });

  it("refuses items on an object, rather than ignoring it", () => {
    expect(() => select({ mode: "replaceArr" }, { items: [0] }, "$")).toThrow(
      "$: upstream holds an object, which items cannot select",
    );
  });

  it("refuses a selection aimed at a value that holds nothing to select", () => {
    expect(() => select({ page: 211 }, { within: { page: { fields: ["x"] } } }, "$")).toThrow(
      "$.page: upstream holds number, which fields cannot select",
    );
  });

  it("refuses naming a structural field prose, which would do nothing", () => {
    expect(() => select({ caption: "Damage Types" }, { prose: ["caption"] }, "$")).toThrow(
      "$: caption is structural, so naming it prose does nothing",
    );
  });

  it("refuses a prose field upstream does not carry", () => {
    expect(() => select({ rows: [["a"]] }, { prose: ["cells"] }, "$")).toThrow(
      "$: upstream has no field cells to elide",
    );
  });

  it("refuses a column label upstream does not carry", () => {
    expect(() => select({ colLabels: ["Rages"] }, { cols: ["Rage Damage"] }, "$")).toThrow(
      '$: no column labelled "Rage Damage"',
    );
  });
});

describe("elide", () => {
  it("replaces prose with the marker", () => {
    expect(elide("Each creature makes a saving throw.")).toBe("Elided.");
  });

  it("leaves markup where it stood, so a fixture can still exercise tags", () => {
    expect(elide("On a hit it takes {@damage 1d10} {{damageType}} damage.")).toBe(
      "Elided. {@damage 1d10} {{damageType}} Elided.",
    );
  });

  it("keeps a reference tag whole, because it names something rather than reading", () => {
    expect(elide("{@item potion of healing}")).toBe("{@item potion of healing}");
  });

  it("empties a formatting tag, whose body is prose however long", () => {
    expect(elide("{@note A whole paragraph of rules text lives in here.}")).toBe("{@note Elided.}");
  });

  it("refuses an unrecognised tag too long to be a name, rather than guessing", () => {
    expect(() => elide(`{@newtag ${"a".repeat(201)}}`)).toThrow(
      "{@newtag} carries 201 characters, too long to take for a name",
    );
  });
});
