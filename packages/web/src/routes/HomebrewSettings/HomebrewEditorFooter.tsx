const BUTTON = "rounded-control px-3.5 py-2 font-semibold text-row";
const SECONDARY = `${BUTTON} border border-border bg-surface text-ink hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50`;

export interface HomebrewEditorFooterProps {
  failure: string | undefined;
  onCancel: () => void;
  stepping: boolean;
  first: boolean;
  last: boolean;
  onAdvance: (by: number) => void;
  saving: boolean;
  onSave: () => void;
}

/**
 * Cancel, why a save failed, Previous and Next while stepping, and Save. Previous and Next
 * stay in place at either end, so focus never drops off a button that vanished.
 */
export function HomebrewEditorFooter({
  failure,
  onCancel,
  stepping,
  first,
  last,
  onAdvance,
  saving,
  onSave,
}: HomebrewEditorFooterProps) {
  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-2">
      <button type="button" onClick={onCancel} className={SECONDARY}>
        Cancel
      </button>
      <p role="alert" className="mr-auto text-error text-row">
        {failure && `Save failed: ${failure}`}
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
          <button
            type="button"
            aria-disabled={last}
            onClick={() => !last && onAdvance(1)}
            className={SECONDARY}
          >
            Next
          </button>
        </>
      )}
      <button
        type="button"
        onClick={onSave}
        aria-disabled={saving}
        className={`${BUTTON} bg-accent text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
