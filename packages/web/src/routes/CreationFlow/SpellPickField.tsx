import type { SearchHit } from "@dnd/catalog";
import { type CharacterRecord, type EntryRef, entryKey } from "@dnd/character";
import { X } from "lucide-react";
import { useId } from "react";
import { CatalogPicker } from "../../components/CatalogPicker/CatalogPicker.tsx";
import { PILL } from "../../lib/chipStyles.ts";
import type { PickedSpell } from "./spellPicks.ts";

const HEADING = "font-semibold text-label text-muted uppercase tracking-label";

export interface SpellPickFieldProps {
  /** The section's name, such as `Cantrips` or `Spells Known`. */
  heading: string;
  /** What one pick is called in the picker's label, such as `cantrip`. */
  noun: string;
  /** How many the class allows, `undefined` where nothing states a number. */
  count?: number;
  picked: readonly PickedSpell[];
  edition: CharacterRecord["edition"];
  /** The `/search` filters the picker narrows by, the class's list and levels among them. */
  filters: Record<string, string>;
  unavailableReason: (hit: SearchHit) => string | undefined;
  onPick: (ref: EntryRef) => void;
  onRemove: (ref: EntryRef) => void;
}

/**
 * One list of picks: how many the class allows and how many are picked, each pick as a
 * removable pill, and the picker that adds another. The count is a note rather than a
 * fence, so a pick past it is kept and `CreationSpells` notes it.
 */
export function SpellPickField({
  heading,
  noun,
  count,
  picked,
  edition,
  filters,
  unavailableReason,
  onPick,
  onRemove,
}: SpellPickFieldProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1.5">
      <h2 id={id} className={HEADING}>
        {heading}
      </h2>
      {count !== undefined && (
        <p
          aria-live="polite"
          className={`text-row ${picked.length === count ? "text-muted" : "font-semibold text-accent-text"}`}
        >
          Choose {count} — {picked.length} selected
        </p>
      )}
      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {picked.map((spell) => (
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
      )}
      <CatalogPicker
        label={`Add a ${noun}`}
        edition={edition}
        type="spell"
        filters={filters}
        unavailableReason={unavailableReason}
        onPick={onPick}
        placeholder={`Search ${noun}s…`}
      />
    </section>
  );
}
