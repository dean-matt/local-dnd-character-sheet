import type { EntryRef } from "@dnd/character";
import { entryKey } from "@dnd/character";
import { X } from "lucide-react";
import { PILL } from "../../lib/chipStyles.ts";
import type { strayPicks } from "./spellPicks.ts";

const HEADING = "font-semibold text-label text-muted uppercase tracking-label";

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
  return strays.map(({ by, spells }) => (
    <section key={by} aria-label={`Picked for ${by}`} className="flex flex-col gap-1.5">
      <h2 className={HEADING}>Picked for {by}</h2>
      <p className="text-muted text-row">{by} offers no picks now.</p>
      <ul className="flex flex-wrap gap-1.5">
        {spells.map((spell) => (
          <li key={entryKey(spell.ref)} className={`${PILL} flex items-center gap-1 pr-1`}>
            {spell.name}
            <button
              type="button"
              onClick={() => onRemove(spell.ref)}
              aria-label={`Remove ${spell.name}`}
              className="flex size-5 items-center justify-center rounded-pill text-muted hover:bg-border"
            >
              <X aria-hidden="true" size={12} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  ));
}
