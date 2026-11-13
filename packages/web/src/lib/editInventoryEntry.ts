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
  if (next !== null) return { ...definition, inventory: definition.inventory.with(index, next) };
  const { id } = entry;
  return {
    ...definition,
    inventory: definition.inventory
      .toSpliced(index, 1)
      .map((other) => (id && other.inside === id ? withoutInside(other) : other)),
  };
}

function withoutInside({ inside: _inside, ...entry }: InventoryEntry): InventoryEntry {
  return entry;
}

/**
 * Places the entry at `index` inside the entry at `holder`, or back outside any where
 * `holder` is null. A container gets its `id` the first time something goes in. `drawn` and
 * `drawnHolder` guard a stale write as `editInventoryEntry` does.
 */
export function placeInventoryEntry(
  definition: CharacterDefinition,
  index: number,
  drawn: InventoryEntry,
  holder: { index: number; drawn: InventoryEntry } | null,
): CharacterDefinition {
  const entry = definition.inventory[index];
  const container = holder && definition.inventory[holder.index];
  if (
    !entry ||
    itemKey(entry) !== itemKey(drawn) ||
    (holder && (!container || itemKey(container) !== itemKey(holder.drawn)))
  ) {
    throw new Error("the inventory changed before this saved, so try again");
  }
  if (!holder || !container) {
    return { ...definition, inventory: definition.inventory.with(index, withoutInside(entry)) };
  }
  const id = container.id ?? crypto.randomUUID();
  return {
    ...definition,
    inventory: definition.inventory
      .with(holder.index, { ...container, id })
      .with(index, { ...entry, inside: id }),
  };
}
