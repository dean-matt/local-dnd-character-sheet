import { characterDefinitionSchema } from "@dnd/character";
import { describe, expect, it } from "vitest";
import { characterRecord } from "../../../../test/records.ts";
import { editInventoryEntry } from "./editInventoryEntry.ts";

const definition = characterDefinitionSchema.parse({
  ...characterRecord("1", "Vex").definition,
  inventory: [
    { ref: { name: "Rope", source: "XPHB" } },
    { ref: { name: "Dagger", source: "XPHB" }, variant: { name: "+1 Weapon", source: "XDMG" } },
  ],
});
const [rope, dagger] = definition.inventory as [
  (typeof definition.inventory)[number],
  (typeof definition.inventory)[number],
];

describe("editInventoryEntry", () => {
  it("replaces the entry at its index, or removes it", () => {
    const more = editInventoryEntry(definition, 1, dagger, (entry) => ({ ...entry, quantity: 3 }));
    expect(more.inventory.map((entry) => entry.quantity)).toEqual([1, 3]);
    expect(editInventoryEntry(definition, 0, rope, () => null).inventory).toEqual([dagger]);
  });

  it("throws rather than edit an entry another write moved into that place", () => {
    const dropped = editInventoryEntry(definition, 0, rope, () => null);
    expect(() => editInventoryEntry(dropped, 0, rope, () => null)).toThrow(
      "the inventory changed before this saved",
    );
    const plain = { ...dagger, variant: undefined };
    expect(() => editInventoryEntry(definition, 1, plain, () => null)).toThrow();
  });
});
