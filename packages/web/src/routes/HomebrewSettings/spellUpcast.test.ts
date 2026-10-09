import { describe, expect, it } from "vitest";
import { upcastName, upcastSection, withUpcastNameFor } from "./spellUpcast.ts";

const spell = (level: number, name: string) => ({
  level,
  entriesHigherLevel: [{ type: "entries", name, entries: ["More."] }],
});

describe("spell upcast text", () => {
  it("names the section as upstream does for each edition and level", () => {
    expect(upcastName("classic", 3)).toBe("At Higher Levels");
    expect(upcastName("one", 3)).toBe("Using a Higher-Level Spell Slot");
    expect(upcastName("one", 0)).toBe("Cantrip Upgrade");
  });

  it("names a new section, and keeps an existing one's name", () => {
    expect(upcastSection(undefined, ["More."], "At Higher Levels")).toEqual({
      type: "entries",
      name: "At Higher Levels",
      entries: ["More."],
    });
    expect(
      upcastSection({ type: "entries", name: "Overchannel" }, ["More."], "Cantrip Upgrade"),
    ).toMatchObject({ name: "Overchannel" });
  });

  it("renames another of upstream's headings, and leaves a heading of the user's own", () => {
    expect(withUpcastNameFor(spell(2, "Using a Higher-Level Spell Slot"), "classic")).toEqual(
      spell(2, "At Higher Levels"),
    );
    expect(withUpcastNameFor(spell(0, "Using a Higher-Level Spell Slot"), "one")).toEqual(
      spell(0, "Cantrip Upgrade"),
    );
    const own = spell(2, "Overchannel");
    expect(withUpcastNameFor(own, "classic")).toBe(own);
    const same = spell(2, "At Higher Levels");
    expect(withUpcastNameFor(same, "classic")).toBe(same);
  });
});
