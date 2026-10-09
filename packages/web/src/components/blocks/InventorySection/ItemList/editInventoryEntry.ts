import { type CharacterDefinition, itemKey } from "@dnd/character";

export type InventoryEntry = CharacterDefinition["inventory"][number];

/**
 * Applies `change` to the entry at `index`, or removes it where `change` returns null.
 * `drawn` is the entry the row was drawn from: a queued write that removed or reordered
 * entries first throws here rather than editing whichever entry took that place.
 */
export function editInventoryEntry(
  definition: CharacterDefinition,
  index: number,
  drawn: InventoryEntry,
  change: (entry: InventoryEntry) => InventoryEntry | null,
): CharacterDefinition {
  const entry = definition.inventory[index];
  if (!entry || itemKey(entry) !== itemKey(drawn)) {
    throw new Error("the inventory changed before this saved, so try again");
  }
  const next = change(entry);
  return {
    ...definition,
    inventory:
      next === null
        ? definition.inventory.toSpliced(index, 1)
        : definition.inventory.with(index, next),
  };
}
