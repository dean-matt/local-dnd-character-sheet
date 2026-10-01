import type { CharacterRecord } from "@dnd/character";
import { Tag } from "./Tag.tsx";

export const EDITION_LABELS: Record<CharacterRecord["edition"], string> = {
  classic: "2014",
  one: "2024",
};

/**
 * A character's edition as its year. A screen reader hears the year's rules alone: the
 * hover title sits on the hidden year, so it is never read as a second description.
 */
export function EditionTag({ edition }: { edition: CharacterRecord["edition"] }) {
  const year = EDITION_LABELS[edition];
  return (
    <span className="shrink-0 self-center">
      <Tag>
        <span aria-hidden="true" title={`This character uses the ${year} rules`}>
          {year}
        </span>
        <span className="sr-only">{year} rules</span>
      </Tag>
    </span>
  );
}
