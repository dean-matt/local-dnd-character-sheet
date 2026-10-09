import { describe, expect, it } from "vitest";
import { classesWorkspace, FIXTURE_VENDOR } from "../test/class-vendor.ts";

describe("the features that offer a choice of features", () => {
  const { build, open, vendorHolding, refusal } = classesWorkspace();

  it("marks Totem Spirit as a choice of one, and each totem as offered by it", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rows = db
      .prepare(
        "SELECT name, source, choose, offered_by_name, offered_by_source FROM subclass_features " +
          "WHERE subclass_short_name = 'Totem Warrior' AND level = 3 ORDER BY name",
      )
      .all();
    db.close();

    const offered = { choose: null, offered_by_name: "Totem Spirit", offered_by_source: "PHB" };
    expect(rows).toEqual([
      { name: "Bear", source: "PHB", ...offered },
      { name: "Eagle", source: "PHB", ...offered },
      { name: "Elk", source: "SCAG", ...offered },
      { name: "Tiger", source: "SCAG", ...offered },
      {
        name: "Totem Spirit",
        source: "PHB",
        choose: 1,
        offered_by_name: null,
        offered_by_source: null,
      },
      { name: "Wolf", source: "PHB", ...offered },
    ]);
  });

  it("reads a class feature's choice nested below its prose", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rows = db
      .prepare(
        "SELECT name, choose, offered_by_name FROM class_features " +
          "WHERE class_source = 'XPHB' AND level = 1 ORDER BY name",
      )
      .all();
    db.close();

    expect(rows).toEqual([
      { name: "Divine Order", choose: 1, offered_by_name: null },
      { name: "Protector", choose: null, offered_by_name: "Divine Order" },
      { name: "Thaumaturge", choose: null, offered_by_name: "Divine Order" },
    ]);
  });

  const feature = (name: string, entries: unknown[] = ["Elided."]) => ({
    name,
    source: "XGE",
    className: "Bard",
    classSource: "PHB",
    level: 3,
    entries,
  });

  const ref = (name: string, level = 3) => ({
    type: "refClassFeature",
    classFeature: `${name}|Bard||${level}|XGE`,
  });

  const offering = (block: Record<string, unknown>, ...options: string[]) => ({
    class: [{ name: "Bard", source: "PHB", hd: { number: 1, faces: 8 } }],
    classFeature: [feature("Flourish", [block]), ...options.map((name) => feature(name))],
  });

  it("marks nothing for an options block with no count, which grants its features together", () => {
    build(
      vendorHolding(
        "class-bard.json",
        offering({ type: "options", entries: [ref("Mobile")] }, "Mobile"),
      ),
    );

    const db = open();
    const marked = db
      .prepare(
        "SELECT COUNT(*) FROM class_features WHERE choose IS NOT NULL OR offered_by_name IS NOT NULL",
      )
      .pluck()
      .get();
    db.close();

    expect(marked).toBe(0);
  });

  it("refuses an option that names no feature at its offering's own level", () => {
    const block = { type: "options", count: 1, entries: [ref("Mobile", 6)] };
    expect(refusal(vendorHolding("class-bard.json", offering(block, "Mobile")))).toMatch(
      /Flourish: option Mobile\|Bard\|\|6\|XGE names no feature beside it/,
    );
  });

  it("refuses a count other than 1, so a new one surfaces rather than being offered as one", () => {
    const block = { type: "options", count: 2, entries: [ref("Mobile"), ref("Slashing")] };
    expect(
      refusal(vendorHolding("class-bard.json", offering(block, "Mobile", "Slashing"))),
    ).toMatch(/Flourish: an options block picks 2, not 1/);
  });
});
