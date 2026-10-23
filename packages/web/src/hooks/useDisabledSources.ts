import { createContext, useContext, useMemo } from "react";
import { useGlobalDisabledSources } from "./useGlobalDisabledSources.ts";

/** What `SheetSourcesProvider` supplies; absent outside it, which reads Settings' list alone. */
export const SheetExclusions = createContext<readonly string[] | undefined>(undefined);

/**
 * The sources a search or picker leaves out: Settings' list, plus the open sheet's own
 * `excludedSources`. The character's list only adds to Settings', so it never turns a source
 * back on.
 */
export function useDisabledSources(): readonly string[] {
  const global = useGlobalDisabledSources();
  const own = useContext(SheetExclusions);
  return useMemo(() => (own ? [...new Set([...global, ...own])].sort() : global), [global, own]);
}
