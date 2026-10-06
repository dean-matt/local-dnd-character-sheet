import { useId } from "react";
import { Link } from "react-router";

const BUTTON = "rounded-control px-3.5 py-2 font-semibold text-body";

/**
 * New Character and Import, drawn where the dashboard offers them. Import has no flow
 * behind it yet, so it is a disabled button with the reason shown beside it, rather than a
 * link to nothing.
 */
export function CharacterActions({ newFirst = false }: { newFirst?: boolean }) {
  const noteId = useId();
  const importButton = (
    <button
      type="button"
      aria-disabled="true"
      aria-describedby={noteId}
      className={`${BUTTON} border border-border bg-surface text-ink aria-disabled:cursor-not-allowed aria-disabled:opacity-60`}
    >
      Import
    </button>
  );
  const newLink = (
    <Link to="/characters/new" className={`${BUTTON} bg-accent text-white hover:bg-accent-hover`}>
      + New Character
    </Link>
  );
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-2">
        {newFirst ? newLink : importButton}
        {newFirst ? importButton : newLink}
      </div>
      <p id={noteId} className="text-muted text-row">
        Import is not built yet
      </p>
    </div>
  );
}
