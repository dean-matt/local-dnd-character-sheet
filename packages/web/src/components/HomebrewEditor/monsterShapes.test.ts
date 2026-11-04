import { describe, expect, it } from "vitest";
import {
  type AlignmentRow,
  alignmentIsEditable,
  alignmentLabel,
  alignmentRows,
  entriesOfParts,
  extraArmorClasses,
  firstArmorClass,
  firstArmorClassWords,
  isPlainTextRow,
  moved,
  prefixText,
  ratingOf,
  rulesParts,
  speedFeet,
  type TypeTagRow,
  typeTagRows,
  withAlignmentRows,
  withArmorClass,
  withArmorClassWords,
  withExtraArmorClasses,
  withPrefix,
  withRating,
  withSpeed,
  withStrings,
  withTypeField,
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
    expect(firstArmorClassWords([{ special: "equal to 10 + level" }, 12])).toBe(
      "equal to 10 + level",
    );
    expect(firstArmorClassWords([12])).toBeUndefined();
    expect(withArmorClassWords([{ special: "x", note: "kept" }, 12], "13 + PB")).toEqual([
      { special: "13 + PB", note: "kept" },
      12,
    ]);
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
    const row = (tag: string, prefix = "", stored?: unknown): TypeTagRow => ({
      tag,
      prefix,
      stored,
    });
    expect(withTypeTags("humanoid", [row("goblinoid")])).toEqual({
      type: "humanoid",
      tags: ["goblinoid"],
    });
    expect(withTypeTags({ type: "humanoid", tags: ["goblinoid"] }, [])).toBe("humanoid");
    expect(withTypeTags({ type: "beast", swarmSize: "T", tags: ["x"] }, [])).toEqual({
      type: "beast",
      swarmSize: "T",
    });
    expect(withTypeTags("humanoid", [row(" dwarf ", " shield "), row(" ")])).toEqual({
      type: "humanoid",
      tags: [{ tag: "dwarf", prefix: "shield" }],
    });
    const hidden = { tag: "elf", prefix: "high", prefixHidden: true };
    expect(withTypeTags("humanoid", [row("elf", "", hidden)])).toEqual({
      type: "humanoid",
      tags: [{ tag: "elf", prefixHidden: true }],
    });
    expect(withTypeTags("humanoid", [row("elf", "", { tag: "elf", prefix: "high" })])).toEqual({
      type: "humanoid",
      tags: ["elf"],
    });
  });

  it("reads plain and prefixed tags as rows, in their stored order", () => {
    const prefixed = { tag: "dwarf", prefix: "shield" };
    const stored = { type: "humanoid", tags: ["a", prefixed, "b"] };
    const rows = typeTagRows(stored);
    expect(rows).toEqual([
      { tag: "a", prefix: "", stored: "a" },
      { tag: "dwarf", prefix: "shield", stored: prefixed },
      { tag: "b", prefix: "", stored: "b" },
    ]);
    expect(withTypeTags(stored, rows)).toEqual(stored);
    const edited = rows.map((each, at) => (at === 1 ? { ...each, prefix: "hill" } : each));
    expect(withTypeTags(stored, edited)).toEqual({
      type: "humanoid",
      tags: ["a", { tag: "dwarf", prefix: "hill" }, "b"],
    });
    expect(withTypeTags({ type: "x", tags: [1, "a"] }, [])).toEqual({ type: "x", tags: [1] });
  });

  it("sets and clears a field on the type", () => {
    expect(withTypeField("beast", "swarmSize", "T")).toEqual({ type: "beast", swarmSize: "T" });
    expect(withTypeField({ type: "beast", swarmSize: "T" }, "swarmSize", undefined)).toBe("beast");
    expect(withTypeField({ type: "beast", swarmSize: "T", tags: ["x"] }, "swarmSize", "S")).toEqual(
      { type: "beast", swarmSize: "S", tags: ["x"] },
    );
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
    expect(isPlainTextRow({ name: "Bite", entries: ["a", { type: "list", items: ["b"] }] })).toBe(
      true,
    );
    expect(isPlainTextRow({ name: "Bite", entries: [{ type: "table", rows: [] }] })).toBe(false);
    expect(
      isPlainTextRow({
        name: "Bite",
        entries: [{ type: "list", items: [{ type: "item", name: "a", entry: "b" }] }],
      }),
    ).toBe(false);
    expect(isPlainTextRow("Bite")).toBe(false);
    expect(isPlainTextRow({ name: 3 })).toBe(false);
  });

  it("reads rules text as paragraphs around each list, and writes it back unchanged", () => {
    const list = { type: "list", style: "list-hang-notitle", items: ["a", "b"] };
    const entries = ["One.", "Two.", list, { type: "list", items: ["c"] }, "Three."];
    const parts = rulesParts(entries);

    expect(parts).toEqual([
      { text: "One.\n\nTwo." },
      { items: ["a", "b"], stored: list },
      { text: "" },
      { items: ["c"], stored: { type: "list", items: ["c"] } },
      { text: "Three." },
    ]);
    expect(entriesOfParts(parts ?? [])).toEqual(entries);
    expect(rulesParts(undefined)).toEqual([{ text: "" }]);
    expect(rulesParts(["a", { type: "table" }])).toBeUndefined();
  });

  it("writes nothing for a blank item, blank text or a list left with no items", () => {
    const stored = { type: "list", style: "list-hang-notitle", items: ["a"] };
    expect(
      entriesOfParts([
        { text: " " },
        { items: [" x ", ""], stored },
        { text: "" },
        { items: [""], stored: { type: "list" } },
        { text: "" },
      ]),
    ).toEqual([{ type: "list", style: "list-hang-notitle", items: ["x"] }]);
    expect(entriesOfParts([{ text: "" }])).toBeUndefined();
  });

  it("reads a nested section as its name and paragraphs, and writes it back unchanged", () => {
    const section = { type: "entries", name: "Heartstone", entries: ["One.", "Two."] };
    const entries = ["Intro.", section, { type: "entries", entries: ["Three."] }];
    const parts = rulesParts(entries);

    expect(parts).toEqual([
      { text: "Intro." },
      { name: "Heartstone", body: "One.\n\nTwo.", stored: section },
      { text: "" },
      { name: "", body: "Three.", stored: { type: "entries", entries: ["Three."] } },
      { text: "" },
    ]);
    expect(entriesOfParts(parts ?? [])).toEqual(entries);
    expect(isPlainTextRow({ name: "Items", entries })).toBe(true);
    expect(
      rulesParts([{ type: "entries", entries: [{ type: "list", items: [] }] }]),
    ).toBeUndefined();
    expect(rulesParts([{ type: "entries", name: 3 }])).toBeUndefined();
  });

  it("writes nothing for a section with neither name nor paragraphs", () => {
    const stored = { type: "entries" };
    expect(
      entriesOfParts([
        { text: "" },
        { name: " ", body: " ", stored },
        { text: "" },
        { name: " Named ", body: "", stored },
        { text: "" },
      ]),
    ).toEqual([{ type: "entries", name: "Named", entries: [] }]);
  });

  it("moves a row, leaving the list alone where there is nowhere to go", () => {
    expect(moved(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    const list = ["a", "b"];
    expect(moved(list, 0, -1)).toBe(list);
    expect(moved(list, 1, 2)).toBe(list);
  });

  it("edits the armor classes after the first with their sources and words, in their slots", () => {
    const ac = [
      { ac: 13, from: ["natural armor"] },
      { ac: 17, from: ["mage armor"], braces: true },
      { special: "x" },
      9,
    ];
    const rows = extraArmorClasses(ac);
    expect(rows.map(({ ac: value, source, special }) => [value, source, special])).toEqual([
      [17, "mage armor", undefined],
      [undefined, "", "x"],
      [9, "", undefined],
    ]);
    expect(withExtraArmorClasses(ac, rows)).toEqual([
      { ac: 13, from: ["natural armor"] },
      { ac: 17, from: ["mage armor"], braces: true },
      { special: "x" },
      9,
    ]);
    expect(
      withExtraArmorClasses(
        ac,
        rows.map((row, at) => (at === 1 ? { ...row, special: "11 + PB" } : row)),
      ),
    ).toEqual([
      { ac: 13, from: ["natural armor"] },
      { ac: 17, from: ["mage armor"], braces: true },
      { special: "11 + PB" },
      9,
    ]);
    expect(
      withExtraArmorClasses(ac, [{ ac: 12, source: "leather, shield", stored: undefined }]),
    ).toEqual([
      { ac: 13, from: ["natural armor"] },
      { ac: 12, from: ["leather", "shield"] },
    ]);
    expect(withExtraArmorClasses([12, 14], [])).toEqual([12]);
  });
});
