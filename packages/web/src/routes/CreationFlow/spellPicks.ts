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

type Counts = { cantrips: number; spells: number };

/**
 * The picks the draft's rows offer beside the class's table: how many each count widens by,
 * and how many of those are owed rather than a ceiling.
 */
export type OtherPicks = Counts & { owed: Counts };

/** One row's offer, as `GET /spells/granted` counts it, and what kind of row it is. */
type Offer = { grantor: string; picks: Counts & { alternatives: boolean } };

/**
 * The picks every row but the class offers, a subclass's only where its own table states no
 * count of that kind, as the Eldritch Knight's does and the Arcana Domain's does not. A
 * row offering alternatives, as Magic Initiate or a 2024 elf's lineages do, widens the
 * counts by its largest block and owes none, since which block is the player's choice.
 */
export function otherPicks(
  offers: readonly Offer[],
  subclassStates: { cantrips: boolean; spells: boolean },
): OtherPicks {
  const sum = { cantrips: 0, spells: 0, owed: { cantrips: 0, spells: 0 } };
  for (const { grantor, picks } of offers) {
    if (grantor === "class") continue;
    const skips = (kind: keyof Counts) => grantor === "subclass" && subclassStates[kind];
    for (const kind of ["cantrips", "spells"] as const) {
      if (skips(kind)) continue;
      sum[kind] += picks[kind];
      if (!picks.alternatives) sum.owed[kind] += picks[kind];
    }
  }
  return sum;
}

/**
 * The picks of one kind the class's list and slots would refuse, less those another row
 * offers, up to the `credit` that row leaves.
 */
function unexcused(
  picks: readonly PickedSpell[],
  refused: (spell: PickedSpell) => boolean,
  credit: number,
) {
  let left = credit;
  return picks.filter((spell) => {
    if (!refused(spell)) return false;
    if (spell.offered && left > 0) {
      left -= 1;
      return false;
    }
    return true;
  });
}

const allowing = (count: number, others: number) =>
  others > 0 ? `${count}, and other rows offer ${others}` : `${count}`;

/**
 * The note on picks the rules would refuse: past a count, off the class's list, or of a
 * level no slot casts. `undefined` where every pick holds. `className` names the list.
 *
 * `others` widens each count by the picks a race, background or feat offers, and excuses
 * that many of its kind from the list and the slots where the row offers the spell.
 * Credit goes by kind rather than by row, so a pick one row offers can spend another's.
 */
export function spellDeparture(
  facts: CasterFacts | undefined,
  picked: readonly PickedSpell[],
  className: string,
  others: Counts,
): string | undefined {
  const cantrips = cantripsOf(picked);
  const spells = spellsOf(picked);
  if (!facts) {
    const stray = [
      ...unexcused(cantrips, () => true, others.cantrips),
      ...unexcused(spells, () => true, others.spells),
    ];
    return stray.length > 0
      ? `${names(stray)} picked for a class that casts no spells at its level.`
      : undefined;
  }
  const refused = (spell: PickedSpell) =>
    spell.listed === false || (spell.level !== undefined && spell.level > facts.maxLevel);
  const stray = [
    ...unexcused(cantrips, refused, others.cantrips),
    ...unexcused(spells, refused, others.spells),
  ];
  const offList = stray.filter((spell) => spell.listed === false);
  const tooHigh = stray.filter((spell) => spell.listed !== false);
  const notes = [
    ...(facts.cantrips !== undefined && cantrips.length > facts.cantrips + others.cantrips
      ? [
          `${cantrips.length} cantrips picked, where the class knows ${allowing(facts.cantrips, others.cantrips)}`,
        ]
      : []),
    ...(facts.spells !== undefined && spells.length > facts.spells + others.spells
      ? [
          `${spells.length} spells ${facts.prepares ? "prepared" : "known"}, where the class allows ${allowing(facts.spells, others.spells)}`,
        ]
      : []),
    ...(offList.length > 0 ? [`${names(offList)} picked off the ${className} spell list`] : []),
    ...(tooHigh.length > 0 ? [`${names(tooHigh)} of a level no slot the class has can cast`] : []),
  ];
  return notes.length > 0 ? `${notes.join("; ")}.` : undefined;
}

/**
 * Whether the picks fill every count the class states and every pick the other rows owe,
 * an overspend counting as filled.
 */
export function spellsFilled(
  facts: CasterFacts | undefined,
  picked: readonly PickedSpell[],
  { owed }: OtherPicks,
) {
  return (
    cantripsOf(picked).length >= (facts?.cantrips ?? 0) + owed.cantrips &&
    spellsOf(picked).length >= (facts?.spells ?? 0) + owed.spells
  );
}
