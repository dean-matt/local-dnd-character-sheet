import { type CharacterDefinition, displayName, type EntryRef, entryKey } from "@dnd/character";
import { useFormContext } from "react-hook-form";
import { useSpellLookup } from "../../../../hooks/useSpellLookup.ts";
import { setRefValue } from "../../../../lib/setRefValue.ts";
import { spellsGained } from "./spellsGained.ts";
import type { useLevelUpClass } from "./useLevelUpClass.ts";

type Spell = CharacterDefinition["spells"][number];

const SPELLBOOK_SOURCES = ["PHB", "XPHB"];

/**
 * The cantrips and spells the level adds to what `cls` knows, and the picks the draft's
 * `spells` holds past `definition`'s, split by the level each lookup found. A pick still
 * loading is left out and keeps `ready` false. A pick lands unprepared, as a known spell
 * or a cantrip is, with the class as its origin. A Wizard's spells go to its spellbook,
 * which `spellbook` reports.
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
  const list = catalog && {
    class: catalog,
    ...(target.subclass && { subclass: target.subclass }),
    level: target.next,
  };
  const known = new Set(definition.spells.map((spell) => entryKey(spell.ref)));
  const added = spells.filter((spell) => !known.has(entryKey(spell.ref)));
  const { looked, failed } = useSpellLookup(
    added.map((spell) => spell.ref),
    () => (list ? { list } : {}),
  );
  const picked = added.flatMap(({ ref }, index) => {
    const found = looked[index];
    if (found === undefined) return [];
    const { name, level } = found ?? { name: displayName(ref), level: undefined };
    return [{ ref, name, level }];
  });
  const cantrips = picked.filter((pick) => pick.level === 0);
  const leveled = picked.filter((pick) => pick.level !== 0);
  const write = (next: Spell[]) => setRefValue(setValue, "spells", next, { shouldDirty: true });
  return {
    gained,
    spellbook,
    list,
    known,
    cantrips,
    spells: leveled,
    failed,
    ready:
      picked.length === added.length &&
      cantrips.length === gained.cantrips &&
      leveled.length === gained.spells,
    add: (ref: EntryRef) =>
      write([...spells, { ref, prepared: false, ...(catalog && { origin: catalog }) }]),
    remove: (ref: EntryRef) =>
      write(spells.filter((spell) => entryKey(spell.ref) !== entryKey(ref))),
  };
}
