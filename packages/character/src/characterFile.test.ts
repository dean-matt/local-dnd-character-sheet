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

  it("refuses a page marked preset, which only an import decides", () => {
    const pages = PRESET_PAGES.map((page) => ({ ...page, preset: true }));
    expect(characterFileSchema.safeParse({ ...file, pages }).success).toBe(false);
  });
});
