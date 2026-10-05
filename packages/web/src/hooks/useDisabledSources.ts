import { useSyncExternalStore } from "react";
import { getDisabledSources, subscribeDisabledSources } from "../lib/disabledSources.ts";

/** The sources Settings turned off, re-rendering on each change. */
export function useDisabledSources(): readonly string[] {
  return useSyncExternalStore(subscribeDisabledSources, getDisabledSources);
}
