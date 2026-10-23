import type { ReactNode } from "react";
import { SheetExclusions } from "../hooks/useDisabledSources.ts";
import { useSheetCharacter } from "../hooks/useSheetCharacter.ts";

/**
 * Hands `useDisabledSources` the open sheet's own `excludedSources` through context, so a
 * view rendered outside the router, such as a test of one picker, still reads Settings'
 * list alone.
 */
export function SheetSourcesProvider({ children }: { children: ReactNode }) {
  const excluded = useSheetCharacter()?.definition.excludedSources;
  return <SheetExclusions.Provider value={excluded}>{children}</SheetExclusions.Provider>;
}
