import { useSheetCharacter } from "../../hooks/useSheetCharacter.ts";

/** Names the character "Add to…" adds to, where the search was opened from its sheet. */
export function SearchedFrom() {
  const sheet = useSheetCharacter();
  return sheet ? (
    <p className="text-row text-muted">
      Add to… adds to {sheet.name}, whose sheet you searched from.
    </p>
  ) : null;
}
