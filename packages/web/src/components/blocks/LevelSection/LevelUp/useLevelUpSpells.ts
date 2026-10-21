import { type CharacterDefinition, displayName, type EntryRef, entryKey } from "@dnd/character";
import { useFormContext } from "react-hook-form";
import { useSpellLookup } from "../../../../hooks/useSpellLookup.ts";
import { setRefValue } from "../../../../lib/setRefValue.ts";
import { spellsGained, subclassSpellsGained } from "./spellsGained.ts";
import type { useLevelUpClass } from "./useLevelUpClass.ts";

type Spell = CharacterDefinition["spells"][number];

const SPELLBOOK_SOURCES = ["PHB", "XPHB"];

/**
 * The cantrips and spells the level adds to what `cls` knows, and those its subclass's
 * features let the character choose, and the picks the draft's `spells` holds past
 * `definition`'s, split by the level each lookup found. A pick still loading is left out and
 * keeps `ready` false. A pick lands unprepared, as a known spell or a cantrip is, with the
 * class as its origin; a subclass pick holds the subclass there until `spellsUnderClass`
 * moves it at Apply, which is what tells the two apart. Each pick states the character level it
 * was `pickedAt`. A Wizard's spells go to its spellbook, which `spellbook`
 * reports.
 */
export function useLevelUpSpells(
  definition: CharacterDefinition,
  cls: EntryRef,
  target: ReturnType<typeof useLevelUpClass>,
  spells: readonly Spell[],
) {
  const { setValue } = useFormContext<CharacterDefinition>();
  const catalog = "name" in cls ? cls : undefined;
  const spellbook = catalog?.name === "Wizard" && SPELLBOOK_SOURCES.includes(catalog.source);
  const gained = spellsGained(
    [target.before, target.subclassBefore],
    [target.after, target.subclassAfter],
    spellbook,
  );
  const { subclass, subclassRow } = target;
  const offered =
    catalog && subclass && subclassRow
      ? subclassSpellsGained(
          subclassRow.json,
          target.subclassBefore !== undefined,
          target.level,
          target.next,
          { after: [target.after, target.subclassAfter], subclass: target.subclassAfter },
          spellbook,
        )
      : { cantrips: 0, spells: 0 };
  const offer = catalog &&
    subclass && {
      grantor: "subclass" as const,
      ref: subclass,
      parent: catalog,
      level: target.next,
    };
  const bySubclass = (spell: Spell) =>
    subclass !== undefined &&
    spell.origin !== undefined &&
    entryKey(spell.origin) === entryKey(subclass);
  const list = catalog && {
    class: catalog,
    ...(target.subclass && { subclass: target.subclass }),
    level: target.next,
  };
  const known = new Set(definition.spells.map((spell) => entryKey(spell.ref)));
  const added = spells.filter((spell) => !known.has(entryKey(spell.ref)));
  const { looked, failed } = useSpellLookup(
    added.map((spell) => spell.ref),
    (index) => {
      const spell = added[index];
      if (spell && bySubclass(spell) && offer) return { offer };
      return list ? { list } : {};
    },
  );
  const read = added.flatMap((spell, index) => {
    const { ref } = spell;
    const found = looked[index];
    if (found === undefined) return [];
    const { name, level, listed } = found ?? { name: displayName(ref), level: undefined };
    return [{ ref, name, level, listed, subclass: bySubclass(spell) }];
  });
  // A past level's subclass picks hold the class as their origin, since Apply moved them
  // there, so the class's picks past its count fill the subclass's offer, unlisted ones first.
  // Where both lists hold a pick the split goes by order, so a class pick can land under a
  // narrower offer that lacks it; stamping a subclass pick with its offer at Apply is the way out.
  const surplus = (cantrip: boolean, room: number, owed: number) => {
    const kind = read.filter((pick) => (pick.level === 0) === cantrip);
    const own = kind.filter((pick) => !pick.subclass);
    const count = Math.min(own.length - room, owed - (kind.length - own.length));
    const ordered = [
      ...own.filter((pick) => pick.listed === false),
      ...own.filter((pick) => pick.listed !== false),
    ];
    return ordered.slice(0, Math.max(0, count)).map((pick) => entryKey(pick.ref));
  };
  const moved = new Set([
    ...surplus(true, gained.cantrips, offered.cantrips),
    ...surplus(false, gained.spells, offered.spells),
  ]);
  const picked = read.map((pick) => ({
    ...pick,
    subclass: pick.subclass || moved.has(entryKey(pick.ref)),
  }));
  const classPicked = picked.filter((pick) => !pick.subclass);
  const subclassPicked = picked.filter((pick) => pick.subclass);
  const cantrips = classPicked.filter((pick) => pick.level === 0);
  const leveled = classPicked.filter((pick) => pick.level !== 0);
  const subclassCantrips = subclassPicked.filter((pick) => pick.level === 0);
  const subclassLeveled = subclassPicked.filter((pick) => pick.level !== 0);
  const pickedAt = definition.levels.length + 1;
  const write = (next: Spell[]) => setRefValue(setValue, "spells", next, { shouldDirty: true });
  return {
    gained,
    spellbook,
    list,
    known,
    cantrips,
    spells: leveled,
    failed,
    offer,
    offered,
    subclassName: subclass?.name ?? "the subclass",
    subclassCantrips,
    subclassSpells: subclassLeveled,
    ready:
      picked.length === added.length &&
      cantrips.length === gained.cantrips &&
      leveled.length === gained.spells &&
      subclassCantrips.length === offered.cantrips &&
      subclassLeveled.length === offered.spells,
    add: (ref: EntryRef) =>
      write([...spells, { ref, prepared: false, ...(catalog && { origin: catalog }), pickedAt }]),
    addSubclass: (ref: EntryRef) =>
      write([...spells, { ref, prepared: false, ...(subclass && { origin: subclass }), pickedAt }]),
    remove: (ref: EntryRef) =>
      write(spells.filter((spell) => entryKey(spell.ref) !== entryKey(ref))),
  };
}
