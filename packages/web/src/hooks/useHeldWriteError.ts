import { useRef } from "react";

/**
 * A write's last error, held while the next write is in flight and cleared once one lands.
 * A mutation drops its error the moment a retry starts, so reading `error` alone would take
 * a failure's toast and outline away before the retry has succeeded.
 */
export function useHeldWriteError(write: { error: Error | null; isPending: boolean }) {
  const held = useRef<Error | null>(null);
  if (write.error) held.current = write.error;
  else if (!write.isPending) held.current = null;
  return held.current;
}
