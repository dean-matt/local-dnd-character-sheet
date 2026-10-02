import type { CharacterRecord } from "@dnd/character";
import { EDITION_LABELS } from "../lib/editionLabels.ts";
import { Tag } from "./Tag.tsx";

/**
 * A character's or a catalog row's edition as its year. A screen reader hears the year's rules alone: the
 * hover title sits on the hidden year, so it is never read as a second description.
 */
export function EditionTag({
  edition,
  of = "character",
}: {
  edition: CharacterRecord["edition"];
  /** What uses the edition, as the hover title names it: "character", "spell". */
  of?: string;
}) {
  const year = EDITION_LABELS[edition];
  return (
    <span className="shrink-0 self-center">
      <Tag>
        <span aria-hidden="true" title={`This ${of} uses the ${year} rules`}>
          {year}
        </span>
        <span className="sr-only">{year} rules</span>
      </Tag>
    </span>
  );
}
