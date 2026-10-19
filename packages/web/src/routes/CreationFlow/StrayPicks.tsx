import type { EntryRef } from "@dnd/character";
import { PickChips } from "../../components/PickChips.tsx";
import { PICK_HEADING } from "../../lib/chipStyles.ts";
import type { strayPicks } from "./spellPicks.ts";

/**
 * The picks made for a row that offers none now, as a changed race or a removed feat
 * leaves behind, each removable so the departure it notes can be cleared.
 */
export function StrayPicks({
  strays,
  onRemove,
}: {
  strays: ReturnType<typeof strayPicks>;
  onRemove: (ref: EntryRef) => void;
}) {
  return strays.map(({ key, by, spells }) => (
    <section key={key} aria-label={`Picked for ${by}`} className="flex flex-col gap-1.5">
      <h2 className={PICK_HEADING}>Picked for {by}</h2>
      <p className="text-muted text-row">{by} offers no picks now.</p>
      <PickChips picked={spells} onRemove={onRemove} />
    </section>
  ));
}
