import { describe, expect, it } from "vitest";
import { characterRecord } from "../../../../test/records.ts";
import { editSpellEntry } from "./editSpellEntry.ts";

const hex = { ref: { name: "Hex", source: "XPHB" }, prepared: false };
const bane = { ref: { name: "Bane", source: "XPHB" }, prepared: false };
const definition = { ...characterRecord("1", "Vex").definition, spells: [hex, bane] };

describe("editSpellEntry", () => {
  it("edits or removes the spell at the index it was drawn from", () => {
    const prepared = editSpellEntry(definition, 1, bane, (entry) => ({ ...entry, prepared: true }));
    expect(prepared.spells).toEqual([hex, { ...bane, prepared: true }]);
    expect(editSpellEntry(definition, 0, hex, () => null).spells).toEqual([bane]);
  });

  it("refuses an index another spell took, or the same spell learned for another class", () => {
    expect(() => editSpellEntry(definition, 0, bane, () => null)).toThrow("spells changed");
    const forWizard = { ...hex, origin: { name: "Wizard", source: "XPHB" } };
    expect(() => editSpellEntry(definition, 0, forWizard, () => null)).toThrow("spells changed");
  });
});
