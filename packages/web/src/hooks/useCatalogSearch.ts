import { searchResponseSchema } from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";
import { useDisabledSources } from "./useDisabledSources.ts";

export interface CatalogSearchParams {
  edition: CharacterRecord["edition"];
  /** Narrows to one kind of row, such as `spell`; absent searches every kind. */
  type?: string;
  query: string;
  limit: number;
}

/**
 * One page of `/search` over the catalog and homebrew together, leaving out every source
 * Settings turned off. A blank query fetches nothing.
 */
export function useCatalogSearch({ edition, type, query, limit }: CatalogSearchParams) {
  const disabled = useDisabledSources();
  const q = query.trim();
  const params = new URLSearchParams({ edition, q, limit: String(limit) });
  if (type !== undefined) params.set("type", type);
  if (disabled.length > 0) params.set("exclude", disabled.join(","));
  return useQuery({
    queryKey: ["search", edition, type, q, limit, disabled],
    queryFn: () => apiGet(`/search?${params}`, searchResponseSchema),
    enabled: q.length > 0,
    retry: retryUnlessClientError,
  });
}
