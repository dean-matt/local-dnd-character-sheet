import { describe, expect, it } from "vitest";
import {
  type CharacterDefinition,
  type CharacterState,
  changePhrases,
  defaultCharacterState,
  describeChange,
  describeStateChange,
  stateChangePhrases,
} from "./index.ts";
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

describe("describeStateChange", () => {
  const state = defaultCharacterState();
  const slot = { level: 1, total: 4, expended: 1 };

  it("is null where nothing changed", () => {
    expect(describeStateChange(state, structuredClone(state))).toBeNull();
  });

  it("names each field with both values, reading null hit points as full", () => {
    const after: CharacterState = {
      ...state,
      hitPoints: { current: 7, temporary: 5 },
      deathSaves: { successes: 0, failures: 2 },
      exhaustion: 1,
    };
    expect(stateChangePhrases(state, after)).toEqual([
      "Hit points full to 7",
      "Temporary hit points 0 to 5",
      "Death save failures 0 to 2",
      "Exhaustion 0 to 1",
    ]);
    expect(describeStateChange(state, after)).toBe(
      "Hit points full to 7, Temporary hit points 0 to 5 and 2 more changes",
    );
  });

  it("records a change its phrase does not show, as the field edited", () => {
    const before: CharacterState = {
      ...state,
      pactSlots: { ...slot, level: 2 },
      conditions: [{ name: "Poisoned", source: "PHB" }],
      resources: [{ name: "Rage", current: 3, maximum: 3, resetsOn: "long" }],
    };
    const after: CharacterState = {
      ...before,
      pactSlots: { ...slot, level: 3 },
      conditions: [{ name: "Poisoned", source: "XPHB" }],
      resources: [{ name: "Rage", current: 3, maximum: 3, resetsOn: "short" }],
    };
    expect(stateChangePhrases(before, after)).toEqual([
      "Pact slots edited",
      "Conditions edited",
      "Rage edited",
    ]);
  });

  it("names a pool, slot or resource by its key with what is left of it", () => {
    const before: CharacterState = {
      ...state,
      hitDice: [{ die: 10, total: 2, remaining: 0 }],
      spellSlots: [slot],
      pactSlots: { ...slot, expended: 2 },
      resources: [{ name: "Rage", current: 0, maximum: 3, resetsOn: "long" }],
      conditions: [{ name: "Poisoned", source: "XPHB" }],
    };
    const after: CharacterState = {
      ...before,
      hitDice: [{ die: 10, total: 2, remaining: 1 }],
      spellSlots: [{ ...slot, expended: 0 }],
      pactSlots: { ...slot, expended: 0 },
      resources: [{ name: "Rage", current: 3, maximum: 3, resetsOn: "long" }],
      conditions: [],
    };
    expect(stateChangePhrases(before, after)).toEqual([
      "d10 hit dice 0 of 2 to 1 of 2",
      "Level 1 spell slots 3 of 4 to 4 of 4",
      "Pact slots 2 of 4 to 4 of 4",
      "Conditions cleared",
      "Rage 0 of 3 to 3 of 3",
    ]);
  });

  it("names a class resource by its key, an unlimited one by what is spent", () => {
    const barbarian = { name: "Barbarian", source: "PHB" };
    const before: CharacterState = {
      ...state,
      classResources: [
        { class: barbarian, key: "rages", maximum: 3, expended: 1 },
        { class: { name: "Monk", source: "PHB" }, key: "ki_points", maximum: null, expended: 0 },
      ],
    };
    const after: CharacterState = {
      ...before,
      classResources: [
        { class: barbarian, key: "rages", maximum: 3, expended: 2 },
        { class: { name: "Monk", source: "PHB" }, key: "ki_points", maximum: null, expended: 1 },
      ],
    };
    expect(stateChangePhrases(before, after)).toEqual([
      "Rages 2 of 3 to 1 of 3",
      "Ki points 0 spent to 1 spent",
    ]);
  });

  it("names an effect starting and ending", () => {
    const raging: CharacterState = { ...state, activeEffects: [{ name: "Rage" }] };
    expect(stateChangePhrases(state, raging)).toEqual(["Rage set to active"]);
    expect(stateChangePhrases(raging, state)).toEqual(["Rage cleared"]);
  });
});
