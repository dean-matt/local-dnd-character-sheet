import type { CatalogKind, CharacterReferences, ContentRef } from "@dnd/character";
import { useCharacterReferences } from "../hooks/useCharacterReferences.ts";
import { Tag } from "./Tag.tsx";

type Unresolved = CharacterReferences["unresolved"];
type Renamed = (unresolved: Unresolved) => ContentRef | undefined;

const same = (a: ContentRef | undefined, b: ContentRef | undefined) =>
  a?.name === b?.name && a?.source === b?.source;

/** The first of `fields`, in order, that the report gives a rename. */
export const renamedAt =
  (...fields: string[]): Renamed =>
  (unresolved) =>
    fields
      .map((field) => unresolved.find((reference) => reference.field === field)?.renamedTo)
      .find((to) => to !== undefined);

/**
 * For a row that knows its reference but not its field. Every entry holding that reference
 * must agree, since a subclass's or a variant's rename depends on its parent too.
 */
export const renamedRef =
  (kinds: readonly CatalogKind[], ref: ContentRef): Renamed =>
  (unresolved) => {
    const held = unresolved.filter(
      (reference) => kinds.includes(reference.kind) && same(reference.ref, ref),
    );
    const to = held[0]?.renamedTo;
    return held.every((reference) => same(reference.renamedTo, to)) ? to : undefined;
  };

/**
 * The chip on a row nothing resolves. Where upstream renamed a catalog reference, the chip
 * names the row it became and the sheet still never shows that row: it is often the other
 * edition's, and moving the character there is the user's call.
 */
export function NotFoundTag({
  characterId,
  homebrew,
  renamed,
}: {
  characterId: string;
  homebrew: boolean;
  renamed: Renamed;
}) {
  const references = useCharacterReferences(characterId, !homebrew);
  if (homebrew) return <Tag>Not found in homebrew</Tag>;
  const to = references.data && renamed(references.data.unresolved);
  if (!to) return <Tag>Not found in the catalog</Tag>;
  return (
    <Tag>
      Renamed to {to.name} ({to.source})
    </Tag>
  );
}
