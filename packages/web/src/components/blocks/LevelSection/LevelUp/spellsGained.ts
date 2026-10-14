import type { ClassGrants } from "@dnd/catalog";
import { casterFacts } from "../../../../lib/casterFacts.ts";

type Table = Pick<ClassGrants, "resources" | "spellSlots">;

const present = (tables: readonly (Table | undefined)[]) =>
  tables.filter((table) => table !== undefined);

/**
 * The cantrips and spells a level adds to what the class knows, read off its and its
 * subclass's tables before and after, and the highest spell level a slot casts after it. A
 * class that prepares its spells gains no spell to pick, though a cantrip still counts.
 */
export function spellsGained(
  before: readonly (Table | undefined)[],
  after: readonly (Table | undefined)[],
) {
  const was = casterFacts(present(before));
  const now = casterFacts(present(after));
  const gain = (key: "cantrips" | "spells") => Math.max(0, (now?.[key] ?? 0) - (was?.[key] ?? 0));
  return {
    cantrips: gain("cantrips"),
    spells: now?.prepares ? 0 : gain("spells"),
    maxLevel: now?.maxLevel ?? 0,
  };
}
