import type { CatalogKind, ContentRef } from "@dnd/character";
import { useCharacterReferences } from "../hooks/useCharacterReferences.ts";
import { Tag } from "./Tag.tsx";

const same = (a: ContentRef, b: ContentRef) => a.name === b.name && a.source === b.source;

/**
 * The chip on a row nothing resolves. `refs` are the row's catalog references, empty for a
 * homebrew one. Where upstream renamed one, the chip names the row it became and the sheet
 * still never shows that row: it is often the other edition's, and moving the character
 * there is the user's call.
 */
export function NotFoundTag({
  characterId,
  kinds,
  refs,
}: {
  characterId: string;
  kinds: readonly CatalogKind[];
  refs: readonly ContentRef[];
}) {
  const references = useCharacterReferences(refs.length > 0 ? characterId : "");
  if (refs.length === 0) return <Tag>Not found in homebrew</Tag>;
  const renamed = refs
    .map(
      (ref) =>
        references.data?.unresolved.find(
          (reference) => kinds.includes(reference.kind) && same(reference.ref, ref),
        )?.renamedTo,
    )
    .find((to) => to !== undefined);
  if (!renamed) return <Tag>Not found in the catalog</Tag>;
  return (
    <Tag>
      Renamed to {renamed.name} ({renamed.source})
    </Tag>
  );
}
