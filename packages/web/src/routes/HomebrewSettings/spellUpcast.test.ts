import { describe, expect, it } from "vitest";
import { upcastSection, withUpcastNameFor } from "./spellUpcast.ts";

const section = (name: string) => ({
  entriesHigherLevel: [{ type: "entries", name, entries: ["More."] }],
});

describe("spell upcast text", () => {
  it("names a new section for the edition, and keeps an existing one's name", () => {
    expect(upcastSection(undefined, ["More."], "classic")).toEqual({
      type: "entries",
      name: "At Higher Levels",
      entries: ["More."],
    });
    expect(upcastSection({ type: "entries", name: "Overchannel" }, ["More."], "one")).toMatchObject(
      {
        name: "Overchannel",
      },
    );
  });

  it("renames the other edition's heading for the edition picked, and leaves a heading of the user's own", () => {
    expect(withUpcastNameFor(section("Using a Higher-Level Spell Slot"), "classic")).toEqual(
      section("At Higher Levels"),
    );
    const own = section("Overchannel");
    expect(withUpcastNameFor(own, "classic")).toBe(own);
    const same = section("At Higher Levels");
    expect(withUpcastNameFor(same, "classic")).toBe(same);
  });
});
