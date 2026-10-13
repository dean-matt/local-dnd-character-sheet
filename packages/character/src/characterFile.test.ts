import { describe, expect, it } from "vitest";
import { characterFileSchema, defaultCharacterState, PRESET_PAGES } from "./index.ts";

const file = {
  format: "local-dnd-character-sheet/character",
  version: 1,
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

describe("characterFileSchema", () => {
  it("reads back what it wrote", () => {
    const parsed = characterFileSchema.parse(file);
    expect(characterFileSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });

  it("refuses a version it does not know, naming the field", () => {
    const result = characterFileSchema.safeParse({ ...file, version: 2 });
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["version"]]);
  });

  it("refuses a file that leaves out a preset page, which a character always holds", () => {
    const result = characterFileSchema.safeParse({ ...file, pages: PRESET_PAGES.slice(1) });
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["pages"]]);
  });

  it("drops the stock Alignment page an older file lists, and keeps an edited one as the user's", () => {
    const section = { kind: "section", section: "alignment" };
    const note = { kind: "text", text: "Oath of Ruin" };
    const stock = { slug: "alignment", title: "Alignment", hidden: true, blocks: [section] };
    const edited = { slug: "alignment", title: "Creed", hidden: false, blocks: [section, note] };

    expect(characterFileSchema.parse({ ...file, pages: [...PRESET_PAGES, stock] }).pages).toEqual(
      PRESET_PAGES,
    );
    expect(
      characterFileSchema.parse({ ...file, pages: [...PRESET_PAGES, edited] }).pages.at(-1),
    ).toEqual({ ...edited, blocks: [{ kind: "unknown", raw: section }, note] });
  });

  it("refuses a page marked preset, which only an import decides", () => {
    const pages = PRESET_PAGES.map((page) => ({ ...page, preset: true }));
    expect(characterFileSchema.safeParse({ ...file, pages }).success).toBe(false);
  });
});
