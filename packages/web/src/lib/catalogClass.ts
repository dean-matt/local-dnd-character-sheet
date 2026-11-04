import { HOMEBREW_SOURCE } from "@dnd/catalog";
import type { CharacterDefinition, ContentRef, EntryRef } from "@dnd/character";

/**
 * `cls` where it names a catalog class. A homebrew class cited by its id or by
 * `(name, "HB")` has no catalog row to read.
 */
export const catalogClass = (cls: EntryRef): ContentRef | undefined =>
  "name" in cls && cls.source.toUpperCase() !== HOMEBREW_SOURCE ? cls : undefined;

/** `cls` where it cites a homebrew class by `(name, "HB")` rather than by id. */
export const homebrewClassByName = (cls: EntryRef): ContentRef | undefined =>
  "name" in cls && cls.source.toUpperCase() === HOMEBREW_SOURCE ? cls : undefined;

/**
 * The id of the homebrew class `cls` cites: its `homebrewId`, or by `(name, "HB")` the row of
 * that name in `rows`, preferring the one in `edition`. Absent for a catalog class, and for a
 * name `rows` lists no class for.
 */
export function homebrewClassId(
  cls: EntryRef,
  rows: readonly { id: string; name: string; edition: CharacterDefinition["edition"] }[] = [],
  edition: CharacterDefinition["edition"],
): string | undefined {
  if ("homebrewId" in cls) return cls.homebrewId;
  const byName = homebrewClassByName(cls)?.name.toLowerCase();
  const named = rows.filter((row) => row.name.toLowerCase() === byName);
  return (named.find((row) => row.edition === edition) ?? named[0])?.id;
}
