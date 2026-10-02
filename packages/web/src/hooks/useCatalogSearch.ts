import { searchResponseSchema } from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

export interface CatalogSearchParams {
  edition: CharacterRecord["edition"];
  /** Narrows to one kind of row, such as `spell`; absent searches every kind. */
  type?: string;
  query: string;
  limit: number;
}

/**
 * One page of `/search` over the catalog and homebrew together. A blank query fetches
 * nothing, and the previous page stays on screen while the next keystroke's loads.
 */
export function useCatalogSearch({ edition, type, query, limit }: CatalogSearchParams) {
  const q = query.trim();
  const params = new URLSearchParams({ edition, q, limit: String(limit) });
  if (type !== undefined) params.set("type", type);
  return useQuery({
    queryKey: ["search", edition, type, q, limit],
    queryFn: () => apiGet(`/search?${params}`, searchResponseSchema),
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
    retry: retryUnlessClientError,
  });
}
