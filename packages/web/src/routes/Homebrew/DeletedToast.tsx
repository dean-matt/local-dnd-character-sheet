import { X } from "lucide-react";

/**
 * Says a row was deleted and offers Undo, which restores it. It stays until dismissed or
 * undone, and a refused restore says why in place; Recently deleted keeps the row after it goes.
 */
export function DeletedToast({
  name,
  restoring,
  failure,
  onUndo,
  onDismiss,
}: {
  name: string;
  restoring: boolean;
  failure: string | undefined;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-50 flex w-96 max-w-[calc(100%-2rem)] items-start gap-2 rounded-card border border-border bg-surface px-3 py-2 text-row shadow-popover print:hidden"
    >
      <div className="min-w-0 grow break-words">
        <p>Deleted {name}.</p>
        {failure && <p className="text-error">Restore failed: {failure}</p>}
      </div>
      <button
        type="button"
        aria-disabled={restoring}
        onClick={() => !restoring && onUndo()}
        className="shrink-0 font-semibold text-accent-text underline aria-disabled:opacity-50"
      >
        {restoring ? "Restoring…" : "Undo"}
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="shrink-0 p-0.5 text-muted hover:text-ink"
      >
        <X aria-hidden="true" size={14} />
      </button>
    </div>
  );
}
