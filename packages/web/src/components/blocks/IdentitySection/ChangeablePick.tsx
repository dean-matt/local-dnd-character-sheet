import type { SearchHit } from "@dnd/catalog";
import type { CharacterRecord, EntryRef } from "@dnd/character";
import { Pencil, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PILL } from "../../../lib/chipStyles.ts";
import { CatalogPicker } from "../../CatalogPicker/CatalogPicker.tsx";

export interface ChangeablePickProps {
  /** What is picked, such as `race`, which names the buttons and the picker. */
  noun: string;
  /** The current pick, as the sheet prints it. */
  value: string;
  edition: CharacterRecord["edition"];
  /** The catalog type the picker searches. */
  type: string;
  onPick: (ref: EntryRef, hit: SearchHit) => void;
  /** Why `hit` cannot be picked, or `undefined` where it can. */
  unavailableReason?: (hit: SearchHit) => string | undefined;
  /** Clears an optional pick; absent for a required one, which offers no clear button. */
  onClear?: () => void;
}

/**
 * A pick shown as a pill, with a button that swaps it for the picker and, for an optional
 * pick, one that clears it. Nothing is cleared while the picker is open, so Cancel leaves
 * the stored pick in place.
 */
export function ChangeablePick({
  noun,
  value,
  edition,
  type,
  onPick,
  unavailableReason,
  onClear,
}: ChangeablePickProps) {
  const [changing, setChanging] = useState(false);
  const [moved, setMoved] = useState(false);
  const change = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (moved && !changing) change.current?.focus();
  }, [moved, changing]);
  const close = () => {
    setChanging(false);
    setMoved(true);
  };

  if (changing) {
    return (
      <div className="flex flex-col gap-1.5">
        <CatalogPicker
          label={`Choose a ${noun}`}
          edition={edition}
          type={type}
          placeholder={`Choose a ${noun}…`}
          unavailableReason={unavailableReason}
          focusOnMount
          onPick={(ref, hit) => {
            onPick(ref, hit);
            close();
          }}
        />
        <button type="button" onClick={close} className="w-fit text-muted text-row underline">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <span className={`${PILL} flex w-fit items-center gap-1 pr-1.5`}>
      {value}
      <button
        type="button"
        ref={change}
        aria-label={`Change ${noun}, ${value}`}
        title={`Change ${noun}`}
        onClick={() => setChanging(true)}
        className="relative flex size-4.5 shrink-0 items-center justify-center text-muted before:absolute before:-inset-1 hover:text-ink"
      >
        <Pencil aria-hidden="true" size={12} />
      </button>
      {onClear && (
        <button
          type="button"
          aria-label={`Clear ${noun}, ${value}`}
          title={`Clear ${noun}`}
          onClick={() => {
            onClear();
            // The clear button leaves with the pick, so focus goes to the one beside it.
            change.current?.focus();
          }}
          className="relative flex size-4.5 shrink-0 items-center justify-center text-muted before:absolute before:-inset-1 hover:text-ink"
        >
          <X aria-hidden="true" size={12} />
        </button>
      )}
    </span>
  );
}
