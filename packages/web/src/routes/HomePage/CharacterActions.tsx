const BUTTON =
  "rounded-control px-3.5 py-2 font-semibold text-body aria-disabled:cursor-not-allowed aria-disabled:opacity-60";
const NOT_BUILT = "Not built yet";

/**
 * New Character and Import, drawn where the dashboard offers them. Neither has a flow behind
 * it yet, so each is a disabled button saying so rather than a link to nothing.
 */
export function CharacterActions({ newFirst = false }: { newFirst?: boolean }) {
  const importButton = (
    <button
      type="button"
      aria-disabled="true"
      title={NOT_BUILT}
      className={`${BUTTON} border border-border bg-surface text-ink`}
    >
      Import
    </button>
  );
  const newButton = (
    <button
      type="button"
      aria-disabled="true"
      title={NOT_BUILT}
      className={`${BUTTON} bg-accent text-white`}
    >
      + New Character
    </button>
  );
  return (
    <div className="flex gap-2">
      {newFirst ? newButton : importButton}
      {newFirst ? importButton : newButton}
    </div>
  );
}
