import { type CharacterDefinition, entryKey, refKey } from "@dnd/character";

type SpellEntry = CharacterDefinition["spells"][number];

const spellKey = (entry: SpellEntry) =>
  `${entryKey(entry.ref)}|${entry.origin ? refKey(entry.origin) : ""}`;

/**
 * Applies `change` to the spell at `index`, or removes it where `change` returns null.
 * `drawn` is the entry the row was drawn from: a queued write that removed or reordered
 * spells first throws here rather than editing whichever spell took that place.
 */
export function editSpellEntry(
  definition: CharacterDefinition,
  index: number,
  drawn: SpellEntry,
  change: (entry: SpellEntry) => SpellEntry | null,
): CharacterDefinition {
  const entry = definition.spells[index];
  if (!entry || spellKey(entry) !== spellKey(drawn)) {
    throw new Error("the spells changed before this saved, so try again");
  }
  const next = change(entry);
  return {
    ...definition,
    spells:
      next === null ? definition.spells.toSpliced(index, 1) : definition.spells.with(index, next),
  };
}
