import type { SearchHit } from "@dnd/catalog";
import { type CharacterRecord, type EntryRef, entryKey } from "@dnd/character";
import { Repeat, X } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { PILL } from "../lib/chipStyles.ts";
import { CatalogPicker } from "./CatalogPicker/CatalogPicker.tsx";

const HEADING = "font-semibold text-label text-muted uppercase tracking-label";
const PILL_BUTTON =
  "flex size-5 items-center justify-center rounded-pill text-muted hover:bg-border";

type Picked = { ref: EntryRef; name: string };

export interface PickFieldProps {
  /** The section's name, such as `Cantrips` or `Spells Known`. */
  heading: string;
  /** The heading's element, one level under whatever holds the field; `h2` unless named. */
  headingLevel?: "h2" | "h4";
  /** What one pick is called in the picker's label, such as `cantrip`. */
  noun: string;
  /** How many the character may pick, `undefined` where nothing states a number. */
  count?: number;
  /** A line under the count, such as what the count comes from. */
  note?: ReactNode;
  picked: readonly Picked[];
  edition: CharacterRecord["edition"];
  /** The kind of row offered, `spell` unless named. */
  type?: string;
  /** The `/search` filters the picker narrows by, such as a class's list and levels. */
  filters: Record<string, string>;
  unavailableReason: (hit: SearchHit) => string | undefined;
  describe?: (hit: SearchHit) => string | undefined;
  onPick: (ref: EntryRef) => void;
  onRemove: (ref: EntryRef) => void;
  /** Offers to swap each pick for another through the same picker, where given. */
  onReplace?: (old: EntryRef, ref: EntryRef) => void;
  /** The edition a swap searches for `ref`, where it differs from `edition`. */
  replaceEdition?: (ref: EntryRef) => CharacterRecord["edition"] | undefined;
}

/**
 * One list of picks: how many the character may pick and how many are picked, each pick as
 * a removable pill, and the picker that adds another or, once a pill's swap is pressed,
 * replaces that pick. The count is a note rather than a fence, so a pick past it is kept and
 * the caller decides what that means.
 */
export function PickField({
  heading,
  headingLevel: Heading = "h2",
  noun,
  count,
  note,
  picked,
  edition,
  type = "spell",
  filters,
  unavailableReason,
  describe,
  onPick,
  onRemove,
  onReplace,
  replaceEdition,
}: PickFieldProps) {
  const id = useId();
  const [replacing, setReplacing] = useState<Picked>();
  // Set once a swap ends, so focus lands on the Add picker rather than the page.
  const [swappedOnce, setSwappedOnce] = useState(false);
  const endSwap = () => {
    setReplacing(undefined);
    setSwappedOnce(true);
  };
  const swapped =
    replacing && picked.find((each) => entryKey(each.ref) === entryKey(replacing.ref));
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1.5">
      <Heading id={id} className={HEADING}>
        {heading}
      </Heading>
      {count !== undefined && (
        <p
          aria-live="polite"
          className={`text-row ${picked.length === count ? "text-muted" : "font-semibold text-accent-text"}`}
        >
          Choose {count} — {picked.length} selected
        </p>
      )}
      {note}
      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {picked.map((pick) => (
            <li key={entryKey(pick.ref)} className={`${PILL} flex items-center gap-1 pr-1`}>
              {pick.name}
              {onReplace && (
                <button
                  type="button"
                  onClick={() => setReplacing(pick)}
                  aria-label={`Replace ${pick.name}`}
                  className={PILL_BUTTON}
                >
                  <Repeat aria-hidden="true" size={12} />
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(pick.ref)}
                aria-label={`Remove ${pick.name}`}
                className={PILL_BUTTON}
              >
                <X aria-hidden="true" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {swapped && onReplace ? (
        <div className="flex items-end gap-2">
          <div className="grow">
            <CatalogPicker
              key={entryKey(swapped.ref)}
              label={`Replace ${swapped.name}`}
              edition={replaceEdition?.(swapped.ref) ?? edition}
              type={type}
              filters={filters}
              unavailableReason={unavailableReason}
              describe={describe}
              onPick={(ref) => {
                onReplace(swapped.ref, ref);
                endSwap();
              }}
              placeholder={`Search ${noun}s…`}
              focusOnMount
            />
          </div>
          <button
            type="button"
            onClick={endSwap}
            className="rounded-control border border-border bg-surface px-3 py-2 text-row hover:bg-subtle"
          >
            Cancel
          </button>
        </div>
      ) : (
        <CatalogPicker
          label={`Add ${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`}
          edition={edition}
          type={type}
          filters={filters}
          unavailableReason={unavailableReason}
          describe={describe}
          onPick={onPick}
          placeholder={`Search ${noun}s…`}
          focusOnMount={swappedOnce}
        />
      )}
    </section>
  );
}
