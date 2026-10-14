import type { ClassGrants } from "@dnd/catalog";

type Table = Pick<ClassGrants, "resources" | "spellSlots">;

/** The first table's value for `key` read as a count, 0 where none states one. */
function count(tables: readonly (Table | undefined)[], key: string): number {
  for (const table of tables) {
    const value = Number(table?.resources.find((each) => each.resourceKey === key)?.value);
    if (Number.isInteger(value)) return value;
  }
  return 0;
}

/**
 * The cantrips and spells a level adds to what the class knows, read off its and its
 * subclass's tables before and after, and the highest spell level a slot casts after it. A
 * class that prepares its spells states no Spells Known column, so it gains no spell to
 * pick, though a cantrip still counts.
 */
export function spellsGained(
  before: readonly (Table | undefined)[],
  after: readonly (Table | undefined)[],
) {
  const gain = (key: string) => Math.max(0, count(after, key) - count(before, key));
  const slotLevels = after.flatMap((table) =>
    (table?.spellSlots ?? []).filter((slot) => slot.slots > 0).map((slot) => slot.slotLevel),
  );
  return {
    cantrips: gain("cantrips_known"),
    spells: gain("spells_known"),
    maxLevel: Math.max(0, ...slotLevels),
  };
}
