import { useRef } from "react";
import type { HomebrewUndo } from "../../hooks/useHomebrewHistory.ts";
import { ClassDieHoldNote } from "./ClassDieHoldNote.tsx";
import type { ClassDieHold } from "./useClassDieHold.ts";

const BUTTON = "rounded-control px-3.5 py-2 font-semibold text-row";
const SECONDARY = `${BUTTON} border border-border bg-surface text-ink hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50`;

export interface HomebrewEditorFooterProps {
  failure: string | undefined;
  onCancel: () => void;
  stepping: boolean;
  first: boolean;
  onAdvance: (by: number) => void;
  saving: boolean;
  /** Why Save is unavailable, drawn to its left; Save holds while it stands. */
  hold?: ClassDieHold;
  /** Reverts the row to the version its last save replaced; absent for a new row. */
  undo?: HomebrewUndo;
  onSave: () => void;
}

/**
 * Cancel, why a save or an undo failed, Previous and Next while stepping, any hold on saving, and Save.
 * Undo, where the row has been saved before, sits beside Save. Previous stays in place on the first step, so focus never drops off a button that vanished.
 */
export function HomebrewEditorFooter({
  failure,
  onCancel,
  stepping,
  first,
  onAdvance,
  saving,
  hold,
  undo,
  onSave,
}: HomebrewEditorFooterProps) {
  const saveButton = useRef<HTMLButtonElement>(null);
  // A read that lands takes the Retry button away with focus on it, so focus moves to Save,
  // whose state says whether the read freed it.
  const retry = async () => {
    const read = (await hold?.retry()) ?? false;
    if (read) saveButton.current?.focus();
    return read;
  };
  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-2">
      <button type="button" onClick={onCancel} className={SECONDARY}>
        Cancel
      </button>
      <p role="alert" className="mr-auto text-error text-row">
        {failure && `Save failed: ${failure}`}
        {undo?.failure && `Undo failed: ${undo.failure}`}
      </p>
      {stepping && (
        <>
          <button
            type="button"
            aria-disabled={first}
            onClick={() => !first && onAdvance(-1)}
            className={SECONDARY}
          >
            Previous
          </button>
          <button type="button" onClick={() => onAdvance(1)} className={SECONDARY}>
            Next
          </button>
        </>
      )}
      {hold && <ClassDieHoldNote hold={{ ...hold, retry }} />}
      {undo && (
        <button
          type="button"
          aria-disabled={!undo.available || undo.pending}
          onClick={() => undo.available && !undo.pending && undo.onUndo()}
          className={SECONDARY}
        >
          {undo.pending ? "Undoing…" : "Undo"}
        </button>
      )}
      <button
        ref={saveButton}
        type="button"
        onClick={onSave}
        aria-disabled={saving || hold !== undefined}
        className={`${BUTTON} bg-accent text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
