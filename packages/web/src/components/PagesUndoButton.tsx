import { Undo2 } from "lucide-react";

/**
 * Undoes the newest change to a character's pages. It takes the caller's
 * `useReplaceCharacterPages` rather than its own, whose separate queue could land the
 * undo ahead of a write still in flight.
 */
export function PagesUndoButton({
  replace,
  onUndone,
}: {
  replace: { canUndo: boolean; undo: () => boolean };
  onUndone: () => void;
}) {
  return (
    <button
      type="button"
      aria-disabled={!replace.canUndo}
      onClick={() => {
        if (replace.undo()) onUndone();
      }}
      className="flex items-center gap-1 rounded-control border border-border px-3 py-1.5 text-muted text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    >
      <Undo2 aria-hidden="true" size={13} />
      Undo page change
    </button>
  );
}
