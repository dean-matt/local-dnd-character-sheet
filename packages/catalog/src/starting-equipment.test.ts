import { describe, expect, it } from "vitest";
import { backgroundStartingEquipmentSchema, classStartingEquipmentSchema } from "./index.ts";

describe("classStartingEquipmentSchema", () => {
  it("reads a classic class's picks, its given items and its gold alternative", () => {
    const wizard = {
      startingEquipment: {
        goldAlternative: "{@dice 4d4 × 10|4d4 × 10|Starting Gold}",
        defaultData: [
          { a: ["quarterstaff|phb"], b: ["dagger|phb"] },
          { a: ["component pouch|phb"], b: [{ equipmentType: "focusSpellcastingArcane" }] },
          { _: ["spellbook|phb"] },
        ],
      },
    };
    expect(classStartingEquipmentSchema.parse(wizard)).toEqual({
      goldAlternative: { dice: "4d4", multiplier: 10 },
      groups: [
        [
          { key: "a", items: [{ kind: "item", name: "quarterstaff", source: "phb", quantity: 1 }] },
          { key: "b", items: [{ kind: "item", name: "dagger", source: "phb", quantity: 1 }] },
        ],
        [
          {
            key: "a",
            items: [{ kind: "item", name: "component pouch", source: "phb", quantity: 1 }],
          },
          {
            key: "b",
            items: [{ kind: "type", types: ["focusSpellcastingArcane"], quantity: 1 }],
          },
        ],
        [{ key: "_", items: [{ kind: "item", name: "spellbook", source: "phb", quantity: 1 }] }],
      ],
    });
  });

  it("reads a 2024 class's options, with quantities, things no row names, and coins", () => {
    const wizard = {
      startingEquipment: {
        defaultData: [
          {
            A: [{ item: "dagger|xphb", quantity: 2 }, { special: "Spellbook" }, { value: 500 }],
            B: [{ value: 5500 }],
          },
        ],
      },
    };
    expect(classStartingEquipmentSchema.parse(wizard)).toEqual({
      groups: [
        [
          {
            key: "A",
            items: [
              { kind: "item", name: "dagger", source: "xphb", quantity: 2 },
              { kind: "special", name: "Spellbook", quantity: 1 },
              { kind: "money", copper: 500 },
            ],
          },
          { key: "B", items: [{ kind: "money", copper: 5500 }] },
        ],
      ],
    });
  });

  it("reads a gold alternative with no multiplier as gold pieces", () => {
    const monk = { startingEquipment: { goldAlternative: "{@dice 5d4|5d4|Starting Gold}" } };
    expect(classStartingEquipmentSchema.parse(monk).goldAlternative).toEqual({
      dice: "5d4",
      multiplier: 1,
    });
  });

  it("offers nothing from a row that states no equipment, or a malformed list", () => {
    expect(classStartingEquipmentSchema.parse({ name: "Mystery" })).toEqual({ groups: [] });
    expect(
      classStartingEquipmentSchema.parse({ startingEquipment: { defaultData: "a sword" } }),
    ).toEqual({ groups: [] });
  });
});

describe("backgroundStartingEquipmentSchema", () => {
  it("reads a pouch's coins, upstream's label and a pick across kinds", () => {
    const row = {
      startingEquipment: [
        {
          _: [
            { item: "pouch|phb", containsValue: 1000 },
            { item: "book|phb", displayName: "prayer book" },
            { equipmentTypes: ["instrumentMusical", "toolArtisan"] },
            { special: "trinket", worthValue: 100 },
            { unknown: true },
          ],
        },
      ],
    };
    expect(backgroundStartingEquipmentSchema.parse(row).groups).toEqual([
      [
        {
          key: "_",
          items: [
            { kind: "item", name: "pouch", source: "phb", quantity: 1 },
            { kind: "money", copper: 1000 },
            { kind: "item", name: "book", source: "phb", quantity: 1, label: "prayer book" },
            { kind: "type", types: ["instrumentMusical", "toolArtisan"], quantity: 1 },
            { kind: "special", name: "trinket", quantity: 1 },
          ],
        },
      ],
    ]);
  });
});
