import { homebrewSpellInputSchema } from "@dnd/catalog";
import { describe, expect, it } from "vitest";
import { checkHomebrewEntry, parseHomebrewEntry } from "./homebrewDraft.ts";

const spell = {
  name: "Coastal Ward",
  level: 2,
  school: "A",
  duration: [{ type: "instant" }],
  entries: ["A wave of brine hardens into a barrier."],
};

const check = (entry: Record<string, unknown>) =>
  checkHomebrewEntry(entry, "one", homebrewSpellInputSchema);

describe("parseHomebrewEntry", () => {
  it("drops a pasted source, which the server stamps", () => {
    expect(parseHomebrewEntry(JSON.stringify({ ...spell, source: "PHB" }))).toEqual({
      entry: spell,
    });
  });

  it("says the text is not JSON", () => {
    expect(parseHomebrewEntry("{ name: ")).toEqual({
      problems: [
        { key: "entry", field: "entry", message: expect.stringMatching(/^Not valid JSON: /) },
      ],
    });
  });

  it("refuses an array where one entry belongs", () => {
    expect(parseHomebrewEntry(JSON.stringify([spell]))).toEqual({
      problems: [{ key: "entry", field: "entry", message: "Expected one JSON object, in braces" }],
    });
  });
});

describe("checkHomebrewEntry", () => {
  it("reads a valid entry with the edition beside it", () => {
    expect(check(spell)).toEqual({ input: { ...spell, edition: "one" } });
  });

  it("names the field a rejected value sits in, down to its index, under its top-level key", () => {
    expect(check({ ...spell, level: 12, entries: ["fine", 7] })).toEqual({
      problems: [
        { key: "level", field: "level", message: expect.any(String) },
        { key: "entries", field: "entries[1]", message: expect.any(String) },
      ],
    });
  });
});
