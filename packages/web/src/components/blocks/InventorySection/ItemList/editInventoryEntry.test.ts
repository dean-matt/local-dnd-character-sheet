import { characterDefinitionSchema } from "@dnd/character";
import { describe, expect, it } from "vitest";
import { characterRecord } from "../../../../test/records.ts";
import { editInventoryEntry, placeInventoryEntry } from "./editInventoryEntry.ts";

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

describe("placeInventoryEntry", () => {
  it("gives the container an id the first time and puts the item inside it", () => {
    const placed = placeInventoryEntry(definition, 1, dagger, { index: 0, drawn: rope });
    const id = placed.inventory[0]?.id;
    expect(id).toBeTruthy();
    expect(placed.inventory[1]?.inside).toBe(id);
    expect(characterDefinitionSchema.safeParse(placed).success).toBe(true);
  });

  it("takes the item back out, and reuses a container's id", () => {
    const placed = placeInventoryEntry(definition, 1, dagger, { index: 0, drawn: rope });
    const out = placeInventoryEntry(placed, 1, dagger, null);
    expect(out.inventory[1]).not.toHaveProperty("inside");
    const again = placeInventoryEntry(out, 1, dagger, { index: 0, drawn: rope });
    expect(again.inventory[0]?.id).toBe(placed.inventory[0]?.id);
  });

  it("throws rather than place into whatever moved into the container's place", () => {
    expect(() => placeInventoryEntry(definition, 0, dagger, { index: 1, drawn: rope })).toThrow(
      "the inventory changed before this saved",
    );
  });

  it("sets contents free when their container is removed", () => {
    const placed = placeInventoryEntry(definition, 1, dagger, { index: 0, drawn: rope });
    const removed = editInventoryEntry(placed, 0, placed.inventory[0] ?? rope, () => null);
    expect(removed.inventory).toHaveLength(1);
    expect(removed.inventory[0]).not.toHaveProperty("inside");
    expect(characterDefinitionSchema.safeParse(removed).success).toBe(true);
  });
});
