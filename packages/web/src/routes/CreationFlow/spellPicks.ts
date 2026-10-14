import type { EntryRef } from "@dnd/character";
import type { CasterFacts } from "../../lib/casterFacts.ts";

/** Where `departures` notes the spells picked against the class's list and counts. */
export const SPELLS_FIELD = "spells";

/** A spell picked, with what the lookup found: no level where no row answers. */
export type PickedSpell = {
  ref: EntryRef;
  name: string;
  level?: number;
  listed?: boolean;
};

const isCantrip = (spell: PickedSpell) => spell.level === 0;

/** The picks split as the step lists them, a spell no row answers among the spells. */
export const cantripsOf = (picked: readonly PickedSpell[]) => picked.filter(isCantrip);

export const spellsOf = (picked: readonly PickedSpell[]) =>
  picked.filter((spell) => !isCantrip(spell));

const names = (spells: readonly PickedSpell[]) => spells.map((spell) => spell.name).join(", ");

type Counts = { cantrips: number; spells: number };

/**
 * The picks the subclass offers beside the class's table: how many each count widens by,
 * and how many of those are owed rather than a ceiling.
 */
export type SubclassPicks = Counts & { owed: Counts };

/** One row's offer, as `GET /spells/granted` counts it, and what kind of row it is. */
type Offer = { grantor: string; picks: Counts & { learned: number; alternatives: boolean } };

/**
 * The picks the subclass offers, each kind only where its own table states no count of
 * it, as the Eldritch Knight's does and the Arcana Domain's does not. Alternative blocks,
 * as the Circle of the Land's terrains, widen the counts by the largest and owe none,
 * since which block is the player's choice. A class that `prepares` takes none of the
 * spells the subclass has it learn, which go into a spellbook rather than among the
 * prepared. Another row's offer counts for nothing here.
 */
export function subclassPicks(
  offers: readonly Offer[],
  subclassStates: { cantrips: boolean; spells: boolean },
  prepares: boolean,
): SubclassPicks {
  const sum = { cantrips: 0, spells: 0, owed: { cantrips: 0, spells: 0 } };
  for (const { grantor, picks } of offers) {
    if (grantor !== "subclass") continue;
    for (const kind of ["cantrips", "spells"] as const) {
      if (subclassStates[kind]) continue;
      const count = picks[kind] - (kind === "spells" && prepares ? picks.learned : 0);
      sum[kind] += count;
      if (!picks.alternatives) sum.owed[kind] += count;
    }
  }
  return sum;
}

const allowing = (count: number, subclass: number) =>
  subclass > 0 ? `${count}, and the subclass offers ${subclass}` : `${count}`;

/**
 * The note on picks the rules would refuse: past a count, off the class's list, or of a
 * level no slot casts. `undefined` where every pick holds. `className` names the list,
 * and `subclass` widens each count by the picks the subclass offers. A class that casts
 * nothing at its level may still make those: the first of each kind stand, and the rest
 * are noted.
 */
export function spellDeparture(
  facts: CasterFacts | undefined,
  picked: readonly PickedSpell[],
  className: string,
  subclass: Counts,
): string | undefined {
  const cantrips = cantripsOf(picked);
  const spells = spellsOf(picked);
  const ordered = [...cantrips, ...spells];
  if (!facts) {
    const stray = [...cantrips.slice(subclass.cantrips), ...spells.slice(subclass.spells)];
    return stray.length > 0
      ? `${names(stray)} picked for a class that casts no spells at its level.`
      : undefined;
  }
  const offList = ordered.filter((spell) => spell.listed === false);
  const tooHigh = ordered.filter(
    (spell) => spell.listed !== false && spell.level !== undefined && spell.level > facts.maxLevel,
  );
  const notes = [
    ...(facts.cantrips !== undefined && cantrips.length > facts.cantrips + subclass.cantrips
      ? [
          `${cantrips.length} cantrips picked, where the class knows ${allowing(facts.cantrips, subclass.cantrips)}`,
        ]
      : []),
    ...(facts.spells !== undefined && spells.length > facts.spells + subclass.spells
      ? [
          `${spells.length} spells ${facts.prepares ? "prepared" : "known"}, where the class allows ${allowing(facts.spells, subclass.spells)}`,
        ]
      : []),
    ...(offList.length > 0 ? [`${names(offList)} picked off the ${className} spell list`] : []),
    ...(tooHigh.length > 0 ? [`${names(tooHigh)} of a level no slot the class has can cast`] : []),
  ];
  return notes.length > 0 ? `${notes.join("; ")}.` : undefined;
}

/**
 * Whether the picks fill every count the class states and every pick the subclass owes,
 * an overspend counting as filled.
 */
export function spellsFilled(
  facts: CasterFacts | undefined,
  picked: readonly PickedSpell[],
  { owed }: SubclassPicks,
) {
  return (
    cantripsOf(picked).length >= (facts?.cantrips ?? 0) + owed.cantrips &&
    spellsOf(picked).length >= (facts?.spells ?? 0) + owed.spells
  );
}
