import { type ClassGrants, eitherPicks, offeredPicks } from "@dnd/catalog";
import { type CharacterDefinition, classLevels, entryKey } from "@dnd/character";
import { casterFacts } from "../../../lib/casterFacts.ts";

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

/**
 * The cantrips and spells a subclass's `additionalSpells` leaves to a pick at `next` beyond
 * those it left at `level`, nothing at `level` where the level picks the subclass, and how
 * many of those spells a cantrip may fill instead, as `either`. A kind the subclass's own
 * table counts is `spellsGained`'s, as the Eldritch Knight's are. A class that prepares its
 * spells or keeps a `spellbook` takes none of the spells a subclass has it learn, which go
 * into the spellbook, and a subclass offering alternative blocks owes none until the player
 * chooses one.
 */
export function subclassSpellsGained(
  json: unknown,
  held: boolean,
  level: number,
  next: number,
  tables: { after: readonly (Table | undefined)[]; subclass: Table | undefined },
  spellbook = false,
) {
  const stated = (...keys: string[]) =>
    (tables.subclass?.resources ?? []).some((each) => keys.includes(each.resourceKey));
  const skipsLearned = spellbook || (casterFacts(present(tables.after))?.prepares ?? false);
  const owed = (at: number) => {
    const picks = offeredPicks(json, at);
    if (picks.alternatives) return { cantrips: 0, spells: 0, either: 0 };
    const either = eitherPicks(json, at);
    return {
      cantrips: picks.cantrips,
      spells: picks.spells - (skipsLearned ? picks.learned : 0),
      either: either.either - (skipsLearned ? either.learned : 0),
    };
  };
  const now = owed(next);
  const was = held ? owed(level) : { cantrips: 0, spells: 0, either: 0 };
  const spells = stated("spells_known", "prepared_spells")
    ? 0
    : Math.max(0, now.spells - was.spells);
  return {
    cantrips: stated("cantrips_known") ? 0 : Math.max(0, now.cantrips - was.cantrips),
    spells,
    either: Math.min(spells, Math.max(0, now.either - was.either)),
  };
}

/**
 * `spells` with each pick the level-up made under the subclass `levels` names for `level`'s
 * class, on that level or an earlier one, moved under the class, whose spellcasting the
 * sheet reads `origin` for. Applied to what is sent, not the draft, so a save that fails
 * leaves the draft telling the two kinds of pick apart.
 */
export function spellsUnderClass(
  spells: CharacterDefinition["spells"],
  levels: readonly CharacterDefinition["levels"][number][],
  level: CharacterDefinition["levels"][number],
): CharacterDefinition["spells"] {
  const cls = level.class;
  const subclass = classLevels({ levels }).find(
    (group) => entryKey(group.class) === entryKey(cls),
  )?.subclass;
  if (!subclass || !("name" in cls)) return spells;
  return spells.map((spell) =>
    spell.origin?.name === subclass.name && spell.origin.source === subclass.source
      ? { ...spell, origin: cls }
      : spell,
  );
}
