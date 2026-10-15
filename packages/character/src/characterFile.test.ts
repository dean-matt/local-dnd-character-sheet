import { describe, expect, it } from "vitest";
import { characterFileSchema, defaultCharacterState, PRESET_PAGES } from "./index.ts";

const file = {
  format: "local-dnd-character-sheet/character",
  version: 2,
  definition: {
    name: "Mira",
    edition: "one",
    levels: [{ class: { name: "Wizard", source: "XPHB" } }],
    race: { name: "Human", source: "XPHB" },
    background: { name: "Sage", source: "XPHB" },
    abilityScores: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
    proficiencies: {
      savingThrows: [],
      skills: [],
      armor: [],
      weapons: [],
      tools: [],
      languages: [],
    },
    inventory: [],
    spells: [],
  },
  state: defaultCharacterState(),
  pages: PRESET_PAGES,
};

/** A file exported before the Backstory preset, which lists every other one. */
const v1 = {
  ...file,
  version: 1,
  pages: PRESET_PAGES.filter((page) => page.slug !== "backstory"),
};

describe("characterFileSchema", () => {
  it("reads back what it wrote", () => {
    const parsed = characterFileSchema.parse(file);
    expect(characterFileSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });

  it("refuses a version it does not know, naming the field", () => {
    const result = characterFileSchema.safeParse({ ...file, version: 3 });
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["version"]]);
  });

  it("reads a file that leaves out a preset page the user deleted", () => {
    const pages = PRESET_PAGES.slice(1);
    expect(characterFileSchema.parse({ ...file, pages }).pages).toEqual(pages);
  });

  it("drops the stock Alignment page a version 1 file lists, and keeps an edited one as the user's", () => {
    const section = { kind: "section", section: "alignment" };
    const note = { kind: "text", text: "Oath of Ruin" };
    const stock = { slug: "alignment", title: "Alignment", hidden: true, blocks: [section] };
    const edited = { slug: "alignment", title: "Creed", hidden: false, blocks: [section, note] };

    expect(characterFileSchema.parse({ ...v1, pages: [...v1.pages, stock] }).pages).toEqual(
      PRESET_PAGES,
    );
    expect(characterFileSchema.parse({ ...v1, pages: [...v1.pages, edited] }).pages.at(-1)).toEqual(
      { ...edited, blocks: [{ kind: "unknown", raw: section }, note] },
    );
  });

  it("gives a version 1 file the stock Backstory page, just before Notes", () => {
    const parsed = characterFileSchema.parse(v1);
    expect(parsed.version).toBe(2);
    expect(parsed.pages).toEqual(PRESET_PAGES);
  });

  it("moves a page a version 1 file holds under backstory aside, keeping its blocks", () => {
    const own = { slug: "backstory", title: "My story", hidden: false, blocks: [] };
    const pages = characterFileSchema.parse({ ...v1, pages: [...v1.pages, own] }).pages;

    expect(pages.slice(0, -1)).toEqual(PRESET_PAGES);
    expect(pages.at(-1)).toEqual({
      ...own,
      slug: expect.stringMatching(/^backstory-[0-9a-f]{8}$/),
    });
  });

  it("keeps a version 2 file's Backstory preset as written, edited or not", () => {
    const edited = PRESET_PAGES.map((page) =>
      page.slug === "backstory"
        ? { ...page, blocks: [{ kind: "text", text: "Raised by wolves" }] }
        : page,
    );
    expect(characterFileSchema.parse({ ...file, pages: edited }).pages).toEqual(edited);
  });

  it("refuses a page marked preset, which only an import decides", () => {
    const pages = PRESET_PAGES.map((page) => ({ ...page, preset: true }));
    expect(characterFileSchema.safeParse({ ...file, pages }).success).toBe(false);
  });
});
