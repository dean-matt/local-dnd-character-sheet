import type { ClassGrants } from "@dnd/catalog";
import { casterFacts } from "../../../../lib/casterFacts.ts";

type Table = Pick<ClassGrants, "resources" | "spellSlots">;

const SPELLBOOK_GAIN = 2;

const present = (tables: readonly (Table | undefined)[]) =>
  tables.filter((table) => table !== undefined);

/**
 * The cantrips and spells a level adds to what the class knows, read off its and its
 * subclass's tables before and after, and the highest spell level a slot casts after it. A
 * class that prepares its spells gains no spell to pick, though a cantrip still counts. A
 * `spellbook` class, the Wizard, copies `SPELLBOOK_GAIN` spells into it at every level whose
 * slots cast, though no table column counts them.
 */
export function spellsGained(
  before: readonly (Table | undefined)[],
  after: readonly (Table | undefined)[],
  spellbook = false,
) {
  const was = casterFacts(present(before));
  const now = casterFacts(present(after));
  const gain = (key: "cantrips" | "spells") => Math.max(0, (now?.[key] ?? 0) - (was?.[key] ?? 0));
  const maxLevel = now?.maxLevel ?? 0;
  const cantrips = gain("cantrips");
  if (spellbook) return { cantrips, spells: maxLevel > 0 ? SPELLBOOK_GAIN : 0, maxLevel };
  return { cantrips, spells: now?.prepares ? 0 : gain("spells"), maxLevel };
}
