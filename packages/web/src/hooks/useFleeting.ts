import { useEffect, useState } from "react";

/** How long a "Saved" status stays before it clears, so a message slot shows only what is happening now. */
export const SAVED_STATUS_MS = 2000;

/**
 * `on`, but only for `ms` after it last turned true. Turning false and true again, as a
 * new save does, restarts the wait.
 */
export function useFleeting(on: boolean, ms = SAVED_STATUS_MS): boolean {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    setExpired(false);
    if (!on) return;
    const timer = setTimeout(() => setExpired(true), ms);
    return () => clearTimeout(timer);
  }, [on, ms]);
  return on && !expired;
}
