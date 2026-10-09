import { useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { isCatalogOutOfDate } from "../lib/api.ts";

/** The message of any query in the cache now failing on an out-of-date catalog. */
export function useCatalogOutOfDate(): string | undefined {
  const cache = useQueryClient().getQueryCache();
  return useSyncExternalStore(
    (onChange) => cache.subscribe(onChange),
    () =>
      cache.findAll().find((query) => isCatalogOutOfDate(query.state.error))?.state.error?.message,
  );
}
