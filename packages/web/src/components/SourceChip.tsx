import type { CharacterRecord } from "@dnd/character";
import { useSourceNames } from "../hooks/useSourceNames.ts";
import { CHIP } from "../lib/chipStyles.ts";
import { EditionTag } from "./EditionTag.tsx";

/**
 * Where a catalog or homebrew row comes from: its source abbreviation, or Homebrew for a
 * row with no source, then the edition's year where the row carries one. A screen reader
 * hears the source's title and the hover shows it; a source no book or adventure titles
 * reads as its abbreviation.
 */
export function SourceChip({
  source,
  edition,
  of,
}: {
  source: string | undefined;
  edition?: CharacterRecord["edition"] | null;
  /** What carries the edition, as `EditionTag`'s hover title names it. */
  of?: string;
}) {
  const names = useSourceNames();
  const title = source && names.data?.get(source);
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span className={`${CHIP} border-border bg-border text-secondary uppercase`}>
        {title ? (
          <>
            <span aria-hidden="true" title={title}>
              {source}
            </span>
            <span className="sr-only">{title}</span>
          </>
        ) : (
          (source ?? "Homebrew")
        )}
      </span>
      {edition && <EditionTag edition={edition} of={of} />}
    </span>
  );
}
