import { describe, expect, it } from "vitest";
import { warlockRecord } from "../../test/records.ts";
import { characterSubtitle } from "./characterSubtitle.ts";

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
