import { type CharacterDefinition, type EntryRef, refKey } from "@dnd/character";
import type { SpellGrantorRef } from "../../hooks/useGrantedSpells.ts";
import type { CasterFacts } from "../../lib/casterFacts.ts";

/** Where `departures` notes the spells picked against the class's list and counts. */
export const SPELLS_FIELD = "spells";

/** The row a pick was made for, where a row other than the class offered it. */
export type PickGrantor = NonNullable<CharacterDefinition["spells"][number]["pickedFor"]>;

/**
 * A spell picked, with what the lookup found: no level where no row answers, and `listed`
 * against the class's list or, for a pick made for a row, that row's offer.
 */
export type PickedSpell = {
  ref: EntryRef;
  name: string;
  level?: number;
  listed?: boolean;
  pickedFor?: PickGrantor;
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

/** One row's offer, as `GET /spells/granted` counts it, and the row making it. */
export type Offer = {
  row: SpellGrantorRef;
  picks: Counts & { learned: number; alternatives: boolean };
};

const grantorKey = (kind: string, ref: { name: string; source: string }) =>
  `${kind}|${refKey(ref)}`;

const pickKey = (pickedFor: PickGrantor) => grantorKey(pickedFor.kind, pickedFor.ref);

/** What a pick made for `row` stores, or `undefined` for the class and subclass, whose picks name none. */
function pickedForOf({ grantor, ref, parent }: SpellGrantorRef): PickGrantor | undefined {
  if (grantor === "class" || grantor === "subclass") return undefined;
  if (grantor === "subrace") return parent ? { kind: grantor, ref, race: parent } : undefined;
  return { kind: grantor, ref };
}

/**
 * The picks a race, subrace, background, feat or optional feature offers, apart from the
 * class's: its own count of each kind, and the picks made for it. Alternative blocks, as
 * Magic Initiate's classes, owe none until a block is chosen.
 */
export type RowPicks = {
  row: SpellGrantorRef;
  pickedFor: PickGrantor;
  counts: Counts;
  owed: Counts;
  picked: PickedSpell[];
};

const add = (a: Counts, b: Counts) => ({
  cantrips: a.cantrips + b.cantrips,
  spells: a.spells + b.spells,
});

/**
 * Each row other than the class and subclass that offers a pick, in the order `offers` lists
 * them. A feat taken twice, as Magic Initiate (XPHB) may be, is one row offering both
 * takings' picks, since a pick names the feat and not which taking it was made for.
 */
export function rowPicks(offers: readonly Offer[], picked: readonly PickedSpell[]): RowPicks[] {
  const rows = new Map<string, RowPicks>();
  for (const { row, picks } of offers) {
    const pickedFor = pickedForOf(row);
    if (!pickedFor || picks.cantrips + picks.spells === 0) continue;
    const key = pickKey(pickedFor);
    const counts = { cantrips: picks.cantrips, spells: picks.spells };
    const owed = picks.alternatives ? { cantrips: 0, spells: 0 } : counts;
    const held = rows.get(key);
    rows.set(
      key,
      held
        ? { ...held, counts: add(held.counts, counts), owed: add(held.owed, owed) }
        : {
            row,
            pickedFor,
            counts,
            owed,
            picked: picked.filter((spell) => spell.pickedFor && pickKey(spell.pickedFor) === key),
          },
    );
  }
  return [...rows.values()];
}

/** The row `pickedFor` names among `rows`, `undefined` where none offers a pick now. */
export const rowFor = (rows: readonly RowPicks[], pickedFor: PickGrantor) =>
  rows.find((row) => pickKey(row.pickedFor) === pickKey(pickedFor));

/** The picks made for the class rather than for a row. */
export const classPicksOf = (picked: readonly PickedSpell[]) =>
  picked.filter((spell) => !spell.pickedFor);

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
  for (const { row, picks } of offers) {
    if (row.grantor !== "subclass") continue;
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

/** The notes on the class's own picks: past a count, off its list, or of a level no slot casts. */
function classNotes(
  facts: CasterFacts | undefined,
  picked: readonly PickedSpell[],
  className: string,
  subclass: Counts,
): string[] {
  const cantrips = cantripsOf(picked);
  const spells = spellsOf(picked);
  const ordered = [...cantrips, ...spells];
  if (!facts) {
    const stray = [...cantrips.slice(subclass.cantrips), ...spells.slice(subclass.spells)];
    return stray.length > 0
      ? [`${names(stray)} picked for a class that casts no spells at its level`]
      : [];
  }
  const offList = ordered.filter((spell) => spell.listed === false);
  const tooHigh = ordered.filter(
    (spell) => spell.listed !== false && spell.level !== undefined && spell.level > facts.maxLevel,
  );
  return [
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
}

/** The notes on one row's picks: past its count of a kind, or outside what it offers. */
function rowNotes({ row, counts, picked }: RowPicks): string[] {
  const by = row.ref.name;
  const past = (kind: "cantrips" | "spells", count: number) =>
    count > counts[kind]
      ? [`${count} ${kind} picked for ${by}, where it offers ${counts[kind]}`]
      : [];
  const offered = picked.filter((spell) => spell.listed === false);
  return [
    ...past("cantrips", cantripsOf(picked).length),
    ...past("spells", spellsOf(picked).length),
    ...(offered.length > 0 ? [`${names(offered)} picked outside what ${by} offers`] : []),
  ];
}

/**
 * The picks made for a row the draft no longer holds, or that offers none now, grouped by
 * the row each was made for, with that row's name.
 */
export function strayPicks(picked: readonly PickedSpell[], rows: readonly RowPicks[]) {
  const byRow = new Map<string, { key: string; by: string; spells: PickedSpell[] }>();
  for (const spell of picked) {
    if (!spell.pickedFor || rowFor(rows, spell.pickedFor)) continue;
    const key = pickKey(spell.pickedFor);
    const group = byRow.get(key) ?? { key, by: spell.pickedFor.ref.name, spells: [] };
    byRow.set(key, { ...group, spells: [...group.spells, spell] });
  }
  return [...byRow.values()];
}

const strayNotes = (picked: readonly PickedSpell[], rows: readonly RowPicks[]) =>
  strayPicks(picked, rows).map(
    ({ by, spells }) => `${names(spells)} picked for ${by}, which offers none`,
  );

/**
 * The note on picks the rules would refuse, `undefined` where every pick holds. A class
 * pick is held to the class's counts and list: past a count, off the list, or of a level
 * no slot casts. `className` names the list, and `subclass` widens each count by the
 * picks the subclass offers. A class that casts nothing at its level may still make those:
 * the first of each kind stand, and the rest are noted. A pick made for a row is held to
 * that row's count and offer alone, so it never widens or excuses a class pick.
 */
export function spellDeparture(
  facts: CasterFacts | undefined,
  picked: readonly PickedSpell[],
  className: string,
  subclass: Counts,
  rows: readonly RowPicks[],
): string | undefined {
  const notes = [
    ...classNotes(facts, classPicksOf(picked), className, subclass),
    ...rows.flatMap(rowNotes),
    ...strayNotes(picked, rows),
  ];
  return notes.length > 0 ? `${notes.join("; ")}.` : undefined;
}

/**
 * Whether the picks fill every count the class states, every pick the subclass owes and
 * every pick each row owes, an overspend counting as filled.
 */
export function spellsFilled(
  facts: CasterFacts | undefined,
  picked: readonly PickedSpell[],
  { owed }: SubclassPicks,
  rows: readonly RowPicks[],
) {
  const own = classPicksOf(picked);
  return (
    cantripsOf(own).length >= (facts?.cantrips ?? 0) + owed.cantrips &&
    spellsOf(own).length >= (facts?.spells ?? 0) + owed.spells &&
    rows.every(
      (row) =>
        cantripsOf(row.picked).length >= row.owed.cantrips &&
        spellsOf(row.picked).length >= row.owed.spells,
    )
  );
}
