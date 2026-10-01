import { describe, expect, it } from "vitest";
import { classesWorkspace, FIXTURE_VENDOR } from "../test/class-vendor.ts";

describe("class and subclass fluff", () => {
  const { build, open } = classesWorkspace();

  it("folds a class's own fluff into its json", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const json = db
      .prepare("SELECT json FROM classes WHERE name = ? AND source = ?")
      .pluck()
      .get("Cleric", "PHB") as string;
    db.close();

    expect(JSON.parse(json)).toHaveProperty("fluff.entries");
  });

  it("keys a subclass's fluff without classSource, since one subclass reaches both", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rows = db
      .prepare(
        "SELECT class_source, json FROM subclasses WHERE name = ? AND source = ? ORDER BY class_source",
      )
      .all("Death Domain", "DMG") as { class_source: string; json: string }[];
    db.close();

    expect(rows.map((row) => row.class_source)).toEqual(["PHB", "XPHB"]);
    for (const row of rows) {
      expect(JSON.parse(row.json)).toHaveProperty("fluff.images");
    }
  });
});
