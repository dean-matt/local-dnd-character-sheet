import { X } from "lucide-react";
import { useEffect } from "react";
import type { AddOutcome } from "../hooks/useAddToCharacter.ts";

const ADDED_TOAST_MS = 5000;

/**
 * What the last "Add to…" did, as a toast that goes after a few seconds or when dismissed.
 * A later outcome is a new object, so it replaces this one and restarts the timer. The live
 * region renders while empty, since one added along with its text is often not announced.
 */
export function AddedToast({
  outcome,
  onDismiss,
}: {
  outcome: AddOutcome | undefined;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!outcome) return;
    const timer = setTimeout(onDismiss, ADDED_TOAST_MS);
    return () => clearTimeout(timer);
  }, [outcome, onDismiss]);

  return (
    <div role="status" aria-label="Last addition">
      {outcome && (
        <div className="fixed right-4 bottom-4 z-50 flex w-96 max-w-[calc(100%-2rem)] items-start gap-2 rounded-card border border-border bg-surface px-3 py-2 text-row shadow-popover print:hidden">
          <div className="min-w-0 grow break-words">
            <p className={`font-semibold ${outcome.failed ? "text-error" : "text-ink"}`}>
              {outcome.text}
            </p>
            {outcome.note && <p className="mt-0.5 text-secondary">{outcome.note}</p>}
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="shrink-0 p-0.5 text-muted hover:text-ink"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
