/**
 * Where the unresolved-references report says a catalog reference was renamed, each a
 * function `NotFoundTag` applies to the report once it loads.
 */
import type { CatalogKind, CharacterReferences, ContentRef } from "@dnd/character";

type Unresolved = CharacterReferences["unresolved"];
export type Renamed = (unresolved: Unresolved) => ContentRef | undefined;

const same = (a: ContentRef, b: ContentRef) => a.name === b.name && a.source === b.source;

/** The first of `fields`, in order, that the report gives a rename. */
export const renamedAt =
  (...fields: string[]): Renamed =>
  (unresolved) =>
    fields
      .map((field) => unresolved.find((reference) => reference.field === field)?.renamedTo)
      .find((to) => to !== undefined);

/**
 * For a row that knows its reference but not its field. The report renames every kind a
 * feature names by its `(name, source)` alone, so any entry holding it gives the same answer.
 */
export const renamedRef =
  (kinds: readonly CatalogKind[], ref: ContentRef): Renamed =>
  (unresolved) =>
    unresolved.find((reference) => kinds.includes(reference.kind) && same(reference.ref, ref))
      ?.renamedTo;
