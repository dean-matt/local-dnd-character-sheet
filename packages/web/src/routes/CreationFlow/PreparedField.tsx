import { type EntryRef, entryKey } from "@dnd/character";
import { useId } from "react";
import { EmptyNote } from "../../components/EmptyNote.tsx";
import { PICK_HEADING } from "../../lib/chipStyles.ts";
import type { PickedSpell } from "./spellPicks.ts";

export interface PreparedFieldProps {
  /** How many the class prepares, `undefined` where nothing states a number. */
  count?: number;
  spellbook: readonly PickedSpell[];
  onToggle: (ref: EntryRef) => void;
}

/**
 * The spellbook's spells, each a pill pressed to prepare it. The count is a note rather
 * than a fence, as `PickField`'s is.
 */
export function PreparedField({ count, spellbook, onToggle }: PreparedFieldProps) {
  const id = useId();
  const prepared = spellbook.filter((spell) => spell.prepared).length;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1.5">
      <h2 id={id} className={PICK_HEADING}>
        Spells Prepared
      </h2>
      {count !== undefined && (
        <p
          aria-live="polite"
          className={`text-row ${prepared === count ? "text-muted" : "font-semibold text-accent-text"}`}
        >
          Choose {count} from the spellbook — {prepared} selected
        </p>
      )}
      {spellbook.length === 0 ? (
        <EmptyNote>Add spells to the spellbook, and prepare them here.</EmptyNote>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {spellbook.map((spell) => (
            <button
              type="button"
              key={entryKey(spell.ref)}
              aria-pressed={spell.prepared === true}
              onClick={() => onToggle(spell.ref)}
              className="rounded-pill border border-border px-3 py-1 font-semibold text-row aria-pressed:border-accent aria-pressed:bg-accent-tint"
            >
              {spell.name}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
