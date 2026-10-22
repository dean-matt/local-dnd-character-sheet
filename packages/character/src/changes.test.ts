import { describe, expect, it } from "vitest";
import { type CharacterDefinition, changePhrases, describeChange } from "./index.ts";
import { definition } from "./test/vex.ts";

const edit = (change: Partial<CharacterDefinition>): CharacterDefinition => ({
  ...structuredClone(definition),
  ...change,
});

describe("describeChange", () => {
  it("is null where nothing changed", () => {
    expect(describeChange(definition, structuredClone(definition))).toBeNull();
  });

  it("names an ability score by its ability, with both values", () => {
    const after = edit({ abilityScores: { ...definition.abilityScores, cha: 18 } });
    expect(describeChange(definition, after)).toEqual({
      paths: ["abilityScores.cha"],
      describedAs: "Charisma 17 to 18",
    });
  });

  it("names a backstory box by the label the sheet gives it", () => {
    const story = edit({ backstory: { ...definition.backstory, story: "Born" } });
    expect(describeChange(definition, story)?.describedAs).toBe("Backstory set to Born");
    const traits = edit({ backstory: { ...definition.backstory, personalityTraits: "Wry" } });
    expect(describeChange(definition, traits)?.describedAs).toBe("Personality traits set to Wry");
  });

  it("names the item and field of a single inventory entry's edit", () => {
    const after = edit({
      inventory: definition.inventory.map((entry, at) =>
        at === 0 ? { ...entry, grip: "two-handed" as const } : entry,
      ),
    });
    expect(describeChange(definition, after)).toEqual({
      paths: ["inventory.0.grip"],
      describedAs: "Dagger grip set to two-handed",
    });
  });

  it("names a whole section where the list changed length", () => {
    const after = edit({ inventory: definition.inventory.slice(1) });
    expect(describeChange(definition, after)?.describedAs).toBe("Inventory edited");
  });

  it("reads an override key as words, and a cleared one as cleared", () => {
    const set = edit({ overrides: { "skills.Stealth|XPHB.modifier": 9 } });
    expect(describeChange(definition, set)?.describedAs).toBe(
      "Skills Stealth modifier override set to 9",
    );
    expect(describeChange(set, definition)?.describedAs).toBe(
      "Skills Stealth modifier override cleared",
    );
    const attack = edit({ overrides: { "attacks.catalog|Dagger|XPHB#0.attackBonus": 7 } });
    expect(describeChange(definition, attack)?.describedAs).toBe(
      "Attacks Dagger attack bonus override set to 7",
    );
  });

  it("reads a first note as set and an emptied one as cleared, naming its section", () => {
    const notes = (text: string) =>
      edit({ notes: [{ id: "s", title: "Debts", notes: [{ id: "n", text }] }] });
    expect(describeChange(notes(""), notes("Buy rope"))).toEqual({
      paths: ["notes.s.n"],
      describedAs: "Debts note set to Buy rope",
    });
    expect(describeChange(notes("Buy rope"), notes(""))?.describedAs).toBe("Debts note cleared");
  });

  it("says edited rather than quoting long text", () => {
    const [debts] = definition.notes;
    if (!debts) throw new Error("the fixture holds a section");
    const after = edit({
      notes: [{ ...debts, notes: debts.notes.map((note) => ({ ...note, text: "x".repeat(41) })) }],
    });
    expect(describeChange(definition, after)?.describedAs).toBe("Debts note edited");
  });

  it("names a retitled section by both titles, and an untitled section's note as a note", () => {
    const titled = (title: string) =>
      edit({ notes: [{ id: "s", title, notes: [{ id: "n", text: "Rope" }] }] });
    expect(describeChange(titled("Debts"), titled("Loans"))).toEqual({
      paths: ["notes.s.title"],
      describedAs: "Notes section Debts to Loans",
    });
    const untitled = edit({
      notes: [{ id: "s", title: "", notes: [{ id: "n", text: "Pitons" }] }],
    });
    expect(describeChange(titled(""), untitled)?.describedAs).toBe("Note Rope to Pitons");
  });

  it("reads a section or note added or removed as the notes edited", () => {
    const added = edit({ notes: [...definition.notes, { id: "new", title: "", notes: [] }] });
    expect(describeChange(definition, added)).toEqual({
      paths: ["notes"],
      describedAs: "Notes edited",
    });
    const emptied = edit({ notes: definition.notes.map((section) => ({ ...section, notes: [] })) });
    expect(describeChange(definition, emptied)?.paths).toEqual(["notes"]);
  });

  it("counts past three changes rather than listing them", () => {
    const after = edit({
      name: "Nyx",
      abilityScores: { ...definition.abilityScores, str: 9, dex: 17, con: 15 },
    });
    expect(describeChange(definition, after)?.describedAs).toBe(
      "Name Vex to Nyx, Strength 8 to 9 and 2 more changes",
    );
    expect(changePhrases(definition, after)).toEqual([
      "Name Vex to Nyx",
      "Strength 8 to 9",
      "Dexterity 16 to 17",
      "Constitution 14 to 15",
    ]);
  });
});
