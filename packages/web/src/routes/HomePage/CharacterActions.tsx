import { useId } from "react";

const BUTTON =
  "rounded-control px-3.5 py-2 font-semibold text-body aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

/**
 * New Character and Import, drawn where the dashboard offers them. Neither has a flow behind
 * it yet, so each is a disabled button with the reason shown beside it, rather than a link
 * to nothing.
 */
export function CharacterActions({ newFirst = false }: { newFirst?: boolean }) {
  const noteId = useId();
  const importButton = (
    <button
      type="button"
      aria-disabled="true"
      aria-describedby={noteId}
      className={`${BUTTON} border border-border bg-surface text-ink`}
    >
      Import
    </button>
  );
  const newButton = (
    <button
      type="button"
      aria-disabled="true"
      aria-describedby={noteId}
      className={`${BUTTON} bg-accent text-white`}
    >
      + New Character
    </button>
  );
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-2">
        {newFirst ? newButton : importButton}
        {newFirst ? importButton : newButton}
      </div>
      <p id={noteId} className="text-muted text-row">
        Not built yet
      </p>
    </div>
  );
}
