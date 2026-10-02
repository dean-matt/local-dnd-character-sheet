import { compareSearchHits } from "@dnd/catalog";
import { searchHitKey } from "../lib/searchHits.ts";
import { useCatalogSearch } from "./useCatalogSearch.ts";

/**
 * `/search` across both editions, merged in the server's ranking, for a reader who has no character's
 * edition to narrow by. A Tier C row with no edition matches either search, so the merge
 * keeps its first copy. `limit` bounds each edition, so a page holds up to twice that.
 */
export function useCompendiumSearch(query: string, limit: number) {
  const classic = useCatalogSearch({ edition: "classic", query, limit });
  const one = useCatalogSearch({ edition: "one", query, limit });
  const searches = [classic, one];

  const seen = new Set<string>();
  const hits = searches
    .flatMap((search) => search.data?.items ?? [])
    .filter((hit) => {
      const key = searchHitKey(hit);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(compareSearchHits(query));

  return {
    hits,
    settled: searches.every((search) => search.data !== undefined),
    fetching: searches.some((search) => search.isFetching),
    error: searches.find((search) => search.isError)?.error ?? null,
  };
}
