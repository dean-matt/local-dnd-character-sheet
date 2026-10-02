import { useCallback, useEffect, useRef } from "react";
import type { FieldValues, UseFormWatch } from "react-hook-form";

/**
 * A form's in-progress values, kept in `localStorage` under its flow so a reload resumes
 * it. Storage can throw in private mode or with blocked site data; the form then runs
 * without a draft rather than failing.
 */
const DEBOUNCE_MS = 300;

const keyOf = (flow: string) => `draft:${flow}`;

/** The stored draft, or `undefined` for none, an unreadable one, or one that is not an object. */
export function readDraft(flow: string): FieldValues | undefined {
  try {
    const stored = localStorage.getItem(keyOf(flow));
    const draft: unknown = stored === null ? undefined : JSON.parse(stored);
    return typeof draft === "object" && draft !== null && !Array.isArray(draft)
      ? (draft as FieldValues)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Writes the form's values a debounce after each change, and at once on unmount or
 * `pagehide`, so neither navigating away nor reloading drops the last edit. `discard`
 * removes the draft and cancels a pending write, which would otherwise restore it.
 */
export function useFormDraft<T extends FieldValues>(flow: string, watch: UseFormWatch<T>) {
  const pending = useRef<unknown>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const values = pending.current;
    pending.current = undefined;
    if (values === undefined) return;
    try {
      localStorage.setItem(keyOf(flow), JSON.stringify(values));
    } catch {}
  }, [flow]);

  useEffect(() => {
    const subscription = watch((values) => {
      pending.current = values;
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, DEBOUNCE_MS);
    });
    window.addEventListener("pagehide", flush);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [watch, flush]);

  return useCallback(() => {
    clearTimeout(timer.current);
    pending.current = undefined;
    try {
      localStorage.removeItem(keyOf(flow));
    } catch {}
  }, [flow]);
}
