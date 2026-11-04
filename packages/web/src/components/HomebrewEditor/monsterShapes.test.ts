import { describe, expect, it } from "vitest";
import {
  type AlignmentRow,
  alignmentIsEditable,
  alignmentLabel,
  alignmentRows,
  armorClassIsProse,
  extraArmorClasses,
  firstArmorClass,
  isPlainTextRow,
  moved,
  prefixText,
  ratingOf,
  speedFeet,
  typeTags,
  withAlignmentRows,
  withArmorClass,
  withExtraArmorClasses,
  withPrefix,
  withRating,
  withSpeed,
  withStrings,
  withTypeTags,
} from "./monsterShapes.ts";

describe("monster shapes", () => {
  it("reads and writes a plain and a conditional speed", () => {
    expect(speedFeet({ walk: 30, fly: { number: 60, condition: "(hover)" } }, "fly")).toBe(60);
    expect(withSpeed({ fly: { number: 60, condition: "(hover)" } }, "fly", 90)).toEqual({
      fly: { number: 90, condition: "(hover)" },
    });
    expect(withSpeed({ walk: 30, climb: 20 }, "climb", undefined)).toEqual({ walk: 30 });
    expect(withSpeed({ walk: 30 }, "walk", undefined)).toEqual({});
    expect(withSpeed(undefined, "swim", 40)).toEqual({ swim: 40 });
  });

  it("edits the first armor class and keeps the rest", () => {
    expect(firstArmorClass([{ ac: 15, from: ["natural armor"] }, 12])).toBe(15);
    expect(withArmorClass([{ ac: 15, from: ["natural armor"] }, 12], 16)).toEqual([
      { ac: 16, from: ["natural armor"] },
      12,
    ]);
    expect(withArmorClass([12], undefined)).toBeUndefined();
    expect(withArmorClass(undefined, 11)).toEqual([11]);
    expect(armorClassIsProse([{ special: "equal to 10 + level" }])).toBe(true);
  });

  it("reads and writes a rating in either form", () => {
    expect(ratingOf({ cr: "1/2", lair: "2" })).toBe("1/2");
    expect(withRating({ cr: "1", lair: "2" }, "3")).toEqual({ cr: "3", lair: "2" });
    expect(withRating("1", "1/4")).toBe("1/4");
  });

  it("labels letters that read alike the same, and a range by its words", () => {
    expect(alignmentLabel(["NX", "E"])).toBe("Neutral evil");
    expect(alignmentLabel(["N", "E"])).toBe("Neutral evil");
    expect(alignmentLabel(["C", "G", "NY", "E"])).toBe("Any chaotic alignment");
  });

  it("reads an alignment's letters, chances, notes and prose as rows", () => {
    expect(alignmentRows(undefined)).toEqual([]);
    expect(alignmentRows(["L", "NX", "C", "E"])).toEqual([
      { letters: ["L", "NX", "C", "E"], note: "", stored: ["L", "NX", "C", "E"] },
    ]);
    const choice = [
      { alignment: ["C", "G"], chance: 75, note: "when calm" },
      { special: "lawful grumpy" },
    ];
    expect(alignmentRows(choice)).toEqual([
      { letters: ["C", "G"], chance: 75, note: "when calm", stored: choice[0] },
      { special: "lawful grumpy", note: "", stored: choice[1] },
    ]);
    expect(alignmentIsEditable("LG")).toBe(false);
    expect(alignmentIsEditable([{ chance: 50 }])).toBe(false);
  });

  it("writes rows back as letters, a choice or prose", () => {
    const row = (change: Partial<AlignmentRow>): AlignmentRow => ({
      note: "",
      stored: undefined,
      ...change,
    });
    expect(withAlignmentRows([row({ letters: ["U"] })])).toEqual(["U"]);
    expect(withAlignmentRows([row({ letters: ["U"], stored: { alignment: ["N"] } })])).toEqual([
      "U",
    ]);
    expect(
      withAlignmentRows([
        row({ letters: ["C", "G"], chance: 75, note: " calm " }),
        row({ letters: ["N", "E"], chance: 25 }),
        row({}),
      ]),
    ).toEqual([
      { alignment: ["C", "G"], chance: 75, note: "calm" },
      { alignment: ["N", "E"], chance: 25 },
    ]);
    expect(withAlignmentRows([row({ special: " neutral oozy " })])).toEqual([
      { special: "neutral oozy" },
    ]);
    expect(withAlignmentRows([row({ special: "" }), row({})])).toBeUndefined();
  });

  it("writes a prefix with the space the stat block reads it with", () => {
    expect(prefixText("typically ")).toBe("typically");
    expect(withPrefix(" usually")).toBe("usually ");
    expect(withPrefix(" ")).toBeUndefined();
  });

  it("writes type tags, returning to a plain type when none are left", () => {
    expect(withTypeTags("humanoid", ["goblinoid"])).toEqual({
      type: "humanoid",
      tags: ["goblinoid"],
    });
    expect(withTypeTags({ type: "humanoid", tags: ["goblinoid"] }, [])).toBe("humanoid");
    expect(withTypeTags({ type: "beast", swarmSize: "T", tags: ["x"] }, [])).toEqual({
      type: "beast",
      swarmSize: "T",
    });
    const prefixed = { tag: "dwarf", prefix: "shield" };
    expect(withTypeTags({ type: "humanoid", tags: [prefixed, "a"] }, ["b"])).toEqual({
      type: "humanoid",
      tags: [prefixed, "b"],
    });
    expect(typeTags({ type: "humanoid", tags: [prefixed, "a"] })).toEqual(["a"]);
  });

  it("drops blank strings from a list and keeps its other entries", () => {
    expect(withStrings(["Common"], [" Elvish ", ""])).toEqual(["Elvish"]);
    expect(withStrings([{ special: "x" }], [])).toEqual([{ special: "x" }]);
    expect(withStrings(["a"], [])).toBeUndefined();
  });

  it("keeps the places of entries the form does not edit", () => {
    const prefixed = { tag: "dwarf", prefix: "shield" };
    expect(withStrings(["a", prefixed, "b"], ["x", "y"])).toEqual(["x", prefixed, "y"]);
    expect(withStrings(["a", prefixed, "b"], ["x"])).toEqual(["x", prefixed]);
    expect(withStrings([prefixed, "a"], ["a", "b"])).toEqual([prefixed, "a", "b"]);
    expect(withStrings([prefixed], ["a"])).toEqual([prefixed, "a"]);
  });

  it("tells a plain text row from one the form leaves to JSON", () => {
    expect(isPlainTextRow({ name: "Bite", entries: ["a"], hidden: true })).toBe(true);
    expect(isPlainTextRow({ name: "Bite" })).toBe(true);
    expect(isPlainTextRow({ name: "Bite", entries: [{ type: "list", items: [] }] })).toBe(false);
    expect(isPlainTextRow("Bite")).toBe(false);
    expect(isPlainTextRow({ name: 3 })).toBe(false);
  });

  it("moves a row, leaving the list alone where there is nowhere to go", () => {
    expect(moved(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    const list = ["a", "b"];
    expect(moved(list, 0, -1)).toBe(list);
    expect(moved(list, 1, 2)).toBe(list);
  });

  it("edits the armor classes after the first with their sources", () => {
    const ac = [
      { ac: 13, from: ["natural armor"] },
      { ac: 17, from: ["mage armor"], braces: true },
      { special: "x" },
      9,
    ];
    const rows = extraArmorClasses(ac);
    expect(rows.map(({ ac: value, source }) => [value, source])).toEqual([
      [17, "mage armor"],
      [9, ""],
    ]);
    expect(withExtraArmorClasses(ac, rows)).toEqual([
      { ac: 13, from: ["natural armor"] },
      { ac: 17, from: ["mage armor"], braces: true },
      { special: "x" },
      9,
    ]);
    expect(
      withExtraArmorClasses(ac, [{ ac: 12, source: "leather, shield", stored: undefined }]),
    ).toEqual([
      { ac: 13, from: ["natural armor"] },
      { ac: 12, from: ["leather", "shield"] },
      { special: "x" },
    ]);
    expect(withExtraArmorClasses([12, 14], [])).toEqual([12]);
  });
});
