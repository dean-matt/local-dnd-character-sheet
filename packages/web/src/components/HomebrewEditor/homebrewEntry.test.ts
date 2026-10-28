import { describe, expect, it } from "vitest";
import {
  entriesOf,
  paragraphsOf,
  signed,
  unsigned,
  withChosen,
  withField,
} from "./homebrewEntry.ts";

describe("homebrew entry fields", () => {
  it("sets a field, and removes one set to undefined, leaving the rest", () => {
    const entry = { name: "Wand", charges: 3, rarity: "rare" };
    expect(withField(entry, "rarity", "legendary")).toEqual({ ...entry, rarity: "legendary" });
    expect(withField(entry, "rarity", undefined)).toEqual({ name: "Wand", charges: 3 });
  });

  it("reads rules text as paragraphs and writes them back, a blank line between each", () => {
    const entries = ["One {@damage 1d6}.", "Two."];
    expect(paragraphsOf(entries)).toBe("One {@damage 1d6}.\n\nTwo.");
    expect(entriesOf("One {@damage 1d6}.\n  \n\nTwo.\n\n")).toEqual(entries);
    expect(entriesOf(" \n ")).toBeUndefined();
    expect(paragraphsOf(undefined)).toBe("");
  });

  it("refuses to read a list or a table as paragraphs", () => {
    expect(paragraphsOf(["One.", { type: "list", items: ["a"] }])).toBeUndefined();
  });

  it("keeps a choice among the names a list holds", () => {
    const resist = ["cold", { choose: { from: ["fire", "acid"] } }];
    expect(withChosen(resist, ["fire"])).toEqual([{ choose: { from: ["fire", "acid"] } }, "fire"]);
    expect(withChosen(["cold"], [])).toBeUndefined();
  });

  it("writes a bonus with its sign, as upstream does", () => {
    expect(signed(1)).toBe("+1");
    expect(signed(-2)).toBe("-2");
    expect(unsigned("+3")).toBe(3);
    expect(unsigned("three")).toBeUndefined();
  });
});
