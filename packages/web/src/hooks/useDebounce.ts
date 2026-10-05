import { useEffect, useState } from "react";

/** `value` once it has held still for `delayMs`; each change before then restarts the wait. */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
