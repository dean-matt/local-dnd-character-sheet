import { X } from "lucide-react";
import { useEffect, useId, useSyncExternalStore } from "react";
import {
  dropSaveToast,
  openSaveToastViewport,
  saveToastState,
  subscribeSaveToasts,
} from "../lib/saveToasts.ts";

/**
 * Where save problems show: one toast per field, each staying until it is dismissed or its
 * field's problem clears. The root layout holds one and every modal another, and only the
 * last mounted draws, so a toast is never stranded behind a modal's inert page.
 */
export function SaveToasts() {
  const id = useId();
  useEffect(() => openSaveToastViewport(id), [id]);
  const { toasts, viewports } = useSyncExternalStore(subscribeSaveToasts, saveToastState);
  const shown = viewports.at(-1) === id ? toasts : [];
  return (
    // Mounted while empty: a live region added with its text is often not announced.
    <section
      aria-label="Save problems"
      aria-live="assertive"
      className="fixed right-4 bottom-4 z-50 flex max-w-[calc(100%-2rem)] flex-col items-end gap-2 print:hidden"
    >
      {shown.map((toast) => (
        <div
          key={toast.id}
          className="flex w-80 max-w-full items-start gap-2 rounded-card border border-error bg-surface px-3 py-2 text-row shadow-popover"
        >
          <p className="min-w-0 grow break-words text-error">
            {toast.field}: {toast.message}
          </p>
          {toast.retry && (
            <button
              type="button"
              onClick={toast.retry}
              className="shrink-0 font-semibold text-error underline"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            aria-label={`Dismiss ${toast.field}`}
            onClick={() => dropSaveToast(toast.id)}
            className="shrink-0 p-0.5 text-muted hover:text-ink"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>
      ))}
    </section>
  );
}
