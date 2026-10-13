import { X } from "lucide-react";
import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import {
  dropSaveToast,
  openSaveToastViewport,
  type SaveToast,
  saveToastState,
  subscribeSaveToasts,
} from "../lib/saveToasts.ts";

/**
 * Where save problems show: one toast per field, each staying until it is dismissed or its
 * field's problem clears. The root layout holds one and every modal another, and only the
 * last mounted draws, so a toast is never stranded behind a modal's inert page. A viewport
 * announces only the toasts raised while it was drawing; one it took over from another sits
 * outside its live region, already announced.
 *
 * Retry and Dismiss can take their toast away with the focus on it. Focus then moves to the
 * next toast, or back to where it was before it entered the region, rather than to the
 * page's top.
 */
export function SaveToasts() {
  const id = useId();
  useEffect(() => openSaveToastViewport(id), [id]);
  const { toasts, viewports } = useSyncExternalStore(subscribeSaveToasts, saveToastState);
  const shown = viewports.at(-1) === id ? toasts : [];
  const inherited = shown.filter((toast) => toast.raisedIn !== id);
  const own = shown.filter((toast) => toast.raisedIn === id);
  const region = useRef<HTMLElement>(null);
  const cameFrom = useRef<HTMLElement | null>(null);
  const restoring = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the toasts change, which is when a pressed button's toast goes
  useEffect(() => {
    const element = region.current;
    if (!restoring.current || !element || element.contains(document.activeElement)) return;
    restoring.current = false;
    // Focus the user moved on their own stays where they put it.
    if (document.activeElement && document.activeElement !== document.body) return;
    const next =
      element.querySelector("button") ?? (cameFrom.current?.isConnected ? cameFrom.current : null);
    next?.focus();
  }, [shown]);

  const press = (action: () => void) => () => {
    restoring.current = true;
    action();
  };

  const draw = (toast: SaveToast) => (
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
          aria-label={`Retry ${toast.field}`}
          onClick={press(toast.retry)}
          className="shrink-0 font-semibold text-error underline"
        >
          Retry
        </button>
      )}
      <button
        type="button"
        aria-label={`Dismiss ${toast.field}`}
        onClick={press(() => dropSaveToast(toast.id))}
        className="shrink-0 p-0.5 text-muted hover:text-ink"
      >
        <X aria-hidden="true" size={14} />
      </button>
    </div>
  );

  return (
    <section
      ref={region}
      onFocus={(event) => {
        const from = event.relatedTarget;
        if (from instanceof HTMLElement && !event.currentTarget.contains(from)) {
          cameFrom.current = from;
        }
      }}
      aria-label="Save problems"
      className="fixed right-4 bottom-4 z-50 flex max-w-[calc(100%-2rem)] flex-col items-end print:hidden"
    >
      {inherited.length > 0 && (
        <div className="flex w-full flex-col items-end gap-2">{inherited.map(draw)}</div>
      )}
      {/* Mounted while empty: a live region added with its text is often not announced. */}
      <div
        aria-live="assertive"
        className={`flex w-full flex-col items-end gap-2 ${inherited.length > 0 && own.length > 0 ? "mt-2" : ""}`}
      >
        {own.map(draw)}
      </div>
    </section>
  );
}
