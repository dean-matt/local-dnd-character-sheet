import { searchResponseSchema } from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";
import { useDisabledSources } from "./useDisabledSources.ts";

/** How long typing must pause before a search goes out. */
export const SEARCH_DEBOUNCE_MS = 200;

export interface CatalogSearchParams {
  /** The ruleset to search; absent searches both. */
  edition?: CharacterRecord["edition"];
  /** Narrows to the kinds of row named, comma-separated, such as `spell`; absent searches every kind. */
  type?: string;
  query: string;
  limit: number;
  offset?: number;
  /** With a blank query, list every row the rest admit instead of fetching nothing. */
  listAll?: boolean;
  /**
   * Keep the last page up while the next loads, so typing does not blank the list. A picker
   * leaves it off: a row from the last query must not be chosen for the new one.
   */
  keepPrevious?: boolean;
  /** Any further `/search` parameter, such as `source` or `minLevel`, as the URL spells it. */
  filters?: Record<string, string>;
}

/**
 * One page of `/search` over the catalog and homebrew together, leaving out every source
 * Settings turned off. A blank query fetches nothing unless `listAll` asks for every row.
 */
export function useCatalogSearch({
  edition,
  type,
  query,
  limit,
  offset,
  listAll = false,
  keepPrevious = false,
  filters,
}: CatalogSearchParams) {
  const disabled = useDisabledSources();
  const q = query.trim();
  const params = new URLSearchParams();
  if (edition !== undefined) params.set("edition", edition);
  if (q !== "") params.set("q", q);
  params.set("limit", String(limit));
  if (offset) params.set("offset", String(offset));
  if (type !== undefined) params.set("type", type);
  for (const [key, value] of Object.entries(filters ?? {})) params.set(key, value);
  if (disabled.length > 0) params.set("exclude", disabled.join(","));
  const enabled = q.length > 0 || listAll;
  return useQuery({
    queryKey: ["search", params.toString()],
    queryFn: () => apiGet(`/search?${params}`, searchResponseSchema),
    enabled,
    // A disabled search shows nothing rather than a stale page.
    placeholderData: keepPrevious && enabled ? keepPreviousData : undefined,
    retry: retryUnlessClientError,
  });
}
