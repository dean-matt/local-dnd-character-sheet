import { describe, expect, it } from "vitest";
import {
  holdsUnread,
  readSpellcasting,
  spellTag,
  writeSpellcasting,
} from "./monsterSpellcasting.ts";

const block = {
  name: "Innate Spellcasting",
  type: "spellcasting",
  ability: "cha",
  displayAs: "action",
  headerEntries: ["The hag casts these spells."],
  will: ["{@spell mage hand}", { entry: "{@spell shield}", hidden: true }],
  daily: { "1e": ["{@spell fly}"], "2": ["{@spell sleep}"] },
  spells: {
    "0": { spells: ["{@spell light}"] },
    "5": { lower: 1, slots: 2, spells: ["{@spell cone of cold}"] },
  },
  weekly: { "1": ["{@spell scrying}"] },
  hidden: ["will"],
  footerEntries: ["{@note She prepares them at dawn.}"],
};

describe("monster spellcasting", () => {
  it("writes back exactly what it reads", () => {
    expect(writeSpellcasting(block, readSpellcasting(block))).toEqual(block);
  });

  it("reads frequencies with each, levels with slots, and paragraphs", () => {
    const form = readSpellcasting(block);
    expect(form).toMatchObject({
      name: "Innate Spellcasting",
      ability: "cha",
      displayAs: "action",
      header: "The hag casts these spells.",
      frequencies: [
        { key: "daily", uses: 2, each: false, spells: ["{@spell sleep}"] },
        { key: "daily", uses: 1, each: true, spells: ["{@spell fly}"] },
      ],
      levels: [
        { level: 0, slots: undefined },
        { level: 5, slots: 2 },
      ],
    });
    expect(readSpellcasting({ type: "spellcasting" }).displayAs).toBe("trait");
    expect(readSpellcasting({ headerEntries: [{ type: "list" }] }).header).toBeUndefined();
  });

  it("drops a trait, a blank name and empty lists, and merges rows sharing a key", () => {
    const form = readSpellcasting(block);
    const written = writeSpellcasting(block, {
      ...form,
      name: " ",
      ability: "",
      displayAs: "trait",
      header: "",
      will: [],
      frequencies: [
        { key: "daily", uses: 1, each: true, spells: ["{@spell fly}"] },
        { key: "daily", uses: 1, each: true, spells: ["{@spell jump}"] },
        { key: "charges", uses: 3, each: false, spells: [] },
      ],
      levels: [
        { level: 3, slots: 1, spells: ["{@spell fireball}"], stored: {} },
        ...form.levels.slice(1).map((level) => ({ ...level, slots: 3 })),
        { level: 1, slots: 4, spells: [], stored: {} },
      ],
    });
    expect(written).toEqual({
      type: "spellcasting",
      daily: { "1e": ["{@spell fly}", "{@spell jump}"] },
      spells: {
        "3": { slots: 1, spells: ["{@spell fireball}"] },
        "5": { lower: 1, slots: 3, spells: ["{@spell cone of cold}"] },
      },
      weekly: { "1": ["{@spell scrying}"] },
      hidden: ["will"],
      footerEntries: ["{@note She prepares them at dawn.}"],
    });
  });

  it("keeps a frequency or level it cannot read", () => {
    const odd = { type: "spellcasting", daily: { often: ["{@spell fly}"] }, spells: { x: 1 } };
    const form = readSpellcasting(odd);
    expect(form.frequencies).toEqual([]);
    expect(form.levels).toEqual([]);
    expect(
      writeSpellcasting(odd, {
        ...form,
        frequencies: [{ key: "daily", uses: 1, each: false, spells: ["{@spell jump}"] }],
      }),
    ).toEqual({
      type: "spellcasting",
      daily: { often: ["{@spell fly}"], "1": ["{@spell jump}"] },
      spells: { x: 1 },
    });
  });

  it("writes a blank or non-positive count, so the API refuses it, and reads it back", () => {
    const written = writeSpellcasting(
      { type: "spellcasting" },
      {
        ...readSpellcasting({}),
        frequencies: [
          { key: "rest", uses: undefined, each: false, spells: ["{@spell haste}"] },
          { key: "daily", uses: -1, each: true, spells: ["{@spell fly}"] },
        ],
      },
    );
    expect(written).toMatchObject({
      rest: { "": ["{@spell haste}"] },
      daily: { "-1e": ["{@spell fly}"] },
    });
    expect(readSpellcasting(written).frequencies).toMatchObject([
      { key: "daily", uses: -1, each: true },
      { key: "rest", uses: undefined, each: false },
    ]);
  });

  it("keeps a field in a shape it cannot read", () => {
    const odd = {
      type: "spellcasting",
      name: 3,
      displayAs: ["action"],
      will: "{@spell light}",
      daily: ["{@spell fly}"],
      spells: "none",
    };
    expect(holdsUnread(odd)).toBe(true);
    expect(holdsUnread(block)).toBe(false);
    expect(writeSpellcasting(odd, { ...readSpellcasting(odd), name: "Psionics" })).toEqual(odd);
  });

  it("drops a level's lower bound that is not below it", () => {
    const form = readSpellcasting(block);
    const levels = form.levels.map((level) => ({ ...level, level: level.level === 5 ? 1 : 0 }));
    expect(writeSpellcasting(block, { ...form, levels }).spells).toEqual({
      "0": { spells: ["{@spell light}"] },
      "1": { slots: 2, spells: ["{@spell cone of cold}"] },
    });
  });

  it("cites a picked spell by name and source", () => {
    expect(spellTag("Cone of Cold", "XPHB")).toBe("{@spell cone of cold|XPHB}");
  });
});
