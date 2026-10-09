import { homebrewSpellInputSchema } from "@dnd/catalog";
import { describe, expect, it } from "vitest";
import { readHomebrewDraft } from "./homebrewDraft.ts";

const spell = {
  name: "Coastal Ward",
  level: 2,
  school: "A",
  duration: [{ type: "instant" }],
  entries: ["A wave of brine hardens into a barrier."],
};

const read = (entry: unknown) =>
  readHomebrewDraft(JSON.stringify(entry), "one", homebrewSpellInputSchema);

describe("readHomebrewDraft", () => {
  it("reads a valid entry with the edition beside it", () => {
    expect(read(spell)).toEqual({ input: { ...spell, edition: "one" } });
  });

  it("names the field a rejected value sits in, down to its index", () => {
    const draft = read({ ...spell, level: 12, entries: ["fine", 7] });
    expect(draft).toEqual({
      problems: [expect.stringMatching(/^level: /), expect.stringMatching(/^entries\[1\]: /)],
    });
  });

  it("says the text is not JSON before checking any field", () => {
    expect(readHomebrewDraft("{ name: ", "one", homebrewSpellInputSchema)).toEqual({
      problems: [expect.stringMatching(/^Not valid JSON: /)],
    });
  });

  it("refuses an array where one entry belongs", () => {
    expect(read([spell])).toEqual({ problems: ["entry: Expected one JSON object, in braces"] });
  });
});
