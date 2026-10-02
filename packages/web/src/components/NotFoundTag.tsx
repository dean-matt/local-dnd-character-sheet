import { useCharacterReferences } from "../hooks/useCharacterReferences.ts";
import type { Renamed } from "../lib/renamed.ts";
import { Tag } from "./Tag.tsx";

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
