import { useEffect, useId, useRef } from "react";
import { dropSaveToast, raiseSaveToast, saveToastState } from "../lib/saveToasts.ts";

/**
 * Raises a toast naming `field` while `message` is set, and drops it once `message` clears.
 * A dismissed toast comes back only with the field's next problem, or where `occurrence`
 * changes, as a repeat of the same failure does: a field passes its latest failure, such as
 * the `Error` itself, so the same text failing again still raises it. Returns the toast's id, for a write that
 * fails after the field has gone.
 *
 * When the field unmounts, a toast for refused text goes with it, as the text does. One for
 * a failed write stays, without Retry, so the lost edit is never silent.
 */
export function useSaveToast(
  field: string,
  message: string | undefined,
  retry?: () => void,
  occurrence?: unknown,
) {
  const id = useId();
  // Read at the click, so a retry runs the field's latest closure without re-raising the toast.
  const latest = useRef(retry);
  latest.current = retry;
  const retryable = retry !== undefined;

  // Declared first, so its cleanup runs before the one below and marks an unmount.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `occurrence` re-raises a toast whose text has not changed
  useEffect(() => {
    if (message === undefined) return;
    raiseSaveToast({
      id,
      field,
      message,
      retry: retryable ? () => latest.current?.() : undefined,
    });
    return () => {
      const showing = saveToastState().toasts.some((toast) => toast.id === id);
      if (!mounted.current && retryable && showing) raiseSaveToast({ id, field, message });
      else dropSaveToast(id);
    };
  }, [id, field, message, retryable, occurrence]);
  return id;
}
