import { describe, expect, it } from "vitest";
import { warlockRecord } from "../../test/records.ts";
import { characterSubtitle, headerSubtitle } from "./characterSubtitle.ts";

const WARLOCK = { name: "Warlock", source: "XPHB" };
const WIZARD = { name: "Wizard", source: "XPHB" };

describe("characterSubtitle", () => {
  it("reads race, class with level and subclass, then background", () => {
    expect(characterSubtitle(warlockRecord())).toBe(
      "Half-Elf Warlock 3 (Fiend Patron) • Charlatan",
    );
  });

  it("joins a multiclass character's classes", () => {
    const record = warlockRecord();
    const levels = [{ class: WARLOCK }, { class: WIZARD }];
    expect(characterSubtitle({ ...record, definition: { ...record.definition, levels } })).toBe(
      "Half-Elf Warlock 1 / Wizard 1 • Charlatan",
    );
  });

  it("leaves out the class segment for a character with no levels", () => {
    const record = warlockRecord();
    const definition = { ...record.definition, levels: [] };
    expect(characterSubtitle({ ...record, definition })).toBe("Half-Elf • Charlatan");
  });

  it("adds an alignment and a deity, the deity with its pantheon, once they are set", () => {
    const record = warlockRecord();
    const definition = {
      ...record.definition,
      alignment: "Chaotic Good" as const,
      deity: { name: "Oghma", source: "PHB", pantheon: "Celtic" },
    };
    expect(characterSubtitle({ ...record, definition })).toBe(
      "Half-Elf Warlock 3 (Fiend Patron) • Charlatan • Chaotic Good • Oghma (Celtic)",
    );

    const realms = { ...definition, deity: { ...definition.deity, pantheon: "Forgotten Realms" } };
    expect(characterSubtitle({ ...record, definition: realms })).toContain(
      "Oghma (Forgotten Realms)",
    );
  });
});

describe("headerSubtitle", () => {
  it("reads the total level, the race and the class, without the class's level or subclass", () => {
    expect(headerSubtitle(warlockRecord())).toBe("Lv. 3 · Half-Elf · Warlock");
  });

  it("joins a multiclass character's classes and counts every level", () => {
    const record = warlockRecord();
    const levels = [{ class: WIZARD }, { class: WARLOCK }, { class: WIZARD }];
    expect(headerSubtitle({ ...record, definition: { ...record.definition, levels } })).toBe(
      "Lv. 3 · Half-Elf · Wizard / Warlock",
    );
  });

  it("leaves out the level and the classes for a character with no levels", () => {
    const record = warlockRecord();
    const definition = { ...record.definition, levels: [] };
    expect(headerSubtitle({ ...record, definition })).toBe("Half-Elf");
  });

  it("leaves out the race where none is summarized", () => {
    expect(headerSubtitle({ ...warlockRecord(), raceSummary: "" })).toBe("Lv. 3 · Warlock");
  });

  it("leaves background, alignment and deity to the Identity tab", () => {
    const record = warlockRecord();
    const definition = {
      ...record.definition,
      alignment: "Chaotic Good" as const,
      deity: { name: "Oghma", source: "PHB", pantheon: "Celtic" },
    };
    expect(headerSubtitle({ ...record, definition })).toBe("Lv. 3 · Half-Elf · Warlock");
  });
});
