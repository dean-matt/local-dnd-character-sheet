import type { ClassGrants } from "@dnd/catalog";
import { type EntryRef, preparedSpellCount } from "@dnd/character";

/** Where `departures` notes the spells picked against the class's list and counts. */
export const SPELLS_FIELD = "spells";

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

/**
 * A spell picked, with what the lookup found: no level where no row answers, and `offered`
 * where a race, background, feat or option offers it as a pick of its own.
 */
export type PickedSpell = {
  ref: EntryRef;
  name: string;
  level?: number;
  listed?: boolean;
  offered?: boolean;
};

const isCantrip = (spell: PickedSpell) => spell.level === 0;

/** The picks split as the step lists them, a spell no row answers among the spells. */
export const cantripsOf = (picked: readonly PickedSpell[]) => picked.filter(isCantrip);

export const spellsOf = (picked: readonly PickedSpell[]) =>
  picked.filter((spell) => !isCantrip(spell));

const names = (spells: readonly PickedSpell[]) => spells.map((spell) => spell.name).join(", ");

const overspent = (picks: readonly PickedSpell[], count: number | undefined) =>
  count !== undefined && picks.length > count + picks.filter((spell) => spell.offered).length;

/**
 * The note on picks the rules would refuse: past a count, off the class's list, or of a
 * level no slot casts. `undefined` where every pick holds. `className` names the list.
 *
 * A pick another row offers, such as a High Elf's wizard cantrip, is excused from all
 * three. Its own count is not read, so each such pick widens the class's count by one and
 * an overspend of the row's count goes unnoted; the way out is the `choose` count as a
 * `spell_grants` column.
 */
export function spellDeparture(
  facts: CasterFacts | undefined,
  picked: readonly PickedSpell[],
  className: string,
): string | undefined {
  const own = picked.filter((spell) => !spell.offered);
  if (!facts) {
    return own.length > 0
      ? `${names(own)} picked for a class that casts no spells at its level.`
      : undefined;
  }
  const cantrips = cantripsOf(picked);
  const spells = spellsOf(picked);
  const offList = own.filter((spell) => spell.listed === false);
  const tooHigh = spellsOf(own).filter(
    (spell) => spell.level !== undefined && spell.level > facts.maxLevel,
  );
  const notes = [
    ...(overspent(cantrips, facts.cantrips)
      ? [`${cantrips.length} cantrips picked, where the class knows ${facts.cantrips}`]
      : []),
    ...(overspent(spells, facts.spells)
      ? [
          `${spells.length} spells ${facts.prepares ? "prepared" : "known"}, where the class allows ${facts.spells}`,
        ]
      : []),
    ...(offList.length > 0 ? [`${names(offList)} picked off the ${className} spell list`] : []),
    ...(tooHigh.length > 0 ? [`${names(tooHigh)} of a level no slot the class has can cast`] : []),
  ];
  return notes.length > 0 ? `${notes.join("; ")}.` : undefined;
}

/** Whether the picks fill every count the class states, an overspend counting as filled. */
export function spellsFilled(facts: CasterFacts | undefined, picked: readonly PickedSpell[]) {
  if (!facts) return true;
  return (
    cantripsOf(picked).length >= (facts.cantrips ?? 0) &&
    spellsOf(picked).length >= (facts.spells ?? 0)
  );
}
