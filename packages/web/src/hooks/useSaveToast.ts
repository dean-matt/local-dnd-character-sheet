import { useEffect, useId, useRef } from "react";
import { dropSaveToast, raiseSaveToast } from "../lib/saveToasts.ts";

/**
 * Raises a toast naming `field` while `message` is set, and drops it once `message` clears
 * or the field unmounts: with the field gone, nothing is left to outline or retry. A
 * dismissed toast comes back only with the field's next problem, or where `occurrence`
 * changes, as a repeat of the same failure does. Returns the toast's id, for a write that
 * fails after the field has gone.
 */
export function useSaveToast(
  field: string,
  message: string | undefined,
  retry?: () => void,
  occurrence = 0,
) {
  const id = useId();
  // Read at the click, so a retry runs the field's latest closure without re-raising the toast.
  const latest = useRef(retry);
  latest.current = retry;
  const retryable = retry !== undefined;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `occurrence` re-raises a toast whose text has not changed
  useEffect(() => {
    if (message === undefined) return;
    raiseSaveToast({
      id,
      field,
      message,
      retry: retryable ? () => latest.current?.() : undefined,
    });
    return () => dropSaveToast(id);
  }, [id, field, message, retryable, occurrence]);
  return id;
}
