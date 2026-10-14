import { createContext } from "react";

/**
 * Writes one key of the definition's `overrides`, or drops it on `null`. Set on the
 * character page alone, so a view outside it, such as the print sheet, offers no override.
 */
export const SaveOverride = createContext<
  ((key: string, next: number | string | null) => Promise<void>) | null
>(null);
