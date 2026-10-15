import { Undo2 } from "lucide-react";

/**
 * Undoes the newest change to a character's pages. `held` keeps it from racing a write
 * outside the page list's queue, such as restoring the defaults.
 */
export function PagesUndoButton({
  replace,
  held = false,
  onUndone,
}: {
  replace: { canUndo: boolean; undo: () => boolean };
  held?: boolean;
  onUndone: () => void;
}) {
  const ready = replace.canUndo && !held;
  return (
    <button
      type="button"
      aria-disabled={!ready}
      onClick={() => {
        if (ready && replace.undo()) onUndone();
      }}
      className="flex items-center gap-1 rounded-control border border-border px-3 py-1.5 text-muted text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    >
      <Undo2 aria-hidden="true" size={13} />
      Undo page change
    </button>
  );
}
