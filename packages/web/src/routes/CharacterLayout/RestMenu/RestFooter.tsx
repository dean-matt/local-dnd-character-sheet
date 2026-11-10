const PRIMARY =
  "min-h-11 rounded-control bg-accent px-3.5 font-semibold text-row text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:bg-subtle aria-disabled:text-muted";

/**
 * The rest dialog's footer: Done once the rest is taken, otherwise Cancel and the button that
 * takes it, named `action` and unavailable unless `canTake`. Every button is unavailable while
 * `busy`.
 */
export function RestFooter({
  taken,
  busy,
  canTake,
  action,
  onClose,
  onTake,
}: {
  taken: boolean;
  busy: boolean;
  canTake: boolean;
  action: string;
  onClose: () => void;
  onTake: () => void;
}) {
  if (taken) {
    return (
      <button type="button" aria-disabled={busy} onClick={onClose} className={PRIMARY}>
        Done
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-disabled={busy}
        onClick={onClose}
        className="min-h-11 rounded-control px-3.5 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:text-muted"
      >
        Cancel
      </button>
      <button type="button" aria-disabled={!canTake || busy} onClick={onTake} className={PRIMARY}>
        {action}
      </button>
    </div>
  );
}
