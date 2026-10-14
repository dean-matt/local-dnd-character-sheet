import type { ClassGrants } from "@dnd/catalog";
import { preparedSpellCount } from "@dnd/character";

type PreparationRule = Parameters<typeof preparedSpellCount>[2];

/**
 * What a class casts at its level. A count is `undefined` where no table states one, as for
 * a homebrew class, which a pick then never overspends.
 */
export type CasterFacts = {
  cantrips?: number;
  spells?: number;
  prepares: boolean;
  /** The highest spell level a slot casts, 0 for a caster of cantrips alone. */
  maxLevel: number;
};

type Table = Pick<ClassGrants, "resources" | "spellSlots">;

/** The first table's value for `key`, read as a count. */
function resource(tables: readonly Table[], key: string): number | undefined {
  for (const table of tables) {
    const value = Number(table.resources.find((each) => each.resourceKey === key)?.value);
    if (Number.isInteger(value)) return value;
  }
  return undefined;
}

/**
 * What the class's and subclass's tables say the class casts, or `undefined` for a class
 * with neither a cantrip nor a slot at its level, as a 2014 paladin at 1st. A printed
 * Prepared Spells column, every 2024 caster's, makes it a preparer; else a 2014 class's
 * `preparation` formula does; else it knows its spells.
 */
export function casterFacts(
  tables: readonly Table[],
  preparation?: { rule: PreparationRule; modifier: number; level: number },
): CasterFacts | undefined {
  const slotLevels = tables.flatMap((table) =>
    table.spellSlots.filter((slot) => slot.slots > 0).map((slot) => slot.slotLevel),
  );
  const maxLevel = Math.max(0, ...slotLevels);
  const cantrips = resource(tables, "cantrips_known") ?? 0;
  if (maxLevel === 0 && cantrips === 0) return undefined;
  const printed = resource(tables, "prepared_spells");
  if (printed !== undefined) return { cantrips, spells: printed, prepares: true, maxLevel };
  if (preparation && maxLevel > 0) {
    const { rule, modifier, level } = preparation;
    const spells = preparedSpellCount(modifier, level, rule);
    return { cantrips, spells, prepares: true, maxLevel };
  }
  return { cantrips, spells: resource(tables, "spells_known") ?? 0, prepares: false, maxLevel };
}
