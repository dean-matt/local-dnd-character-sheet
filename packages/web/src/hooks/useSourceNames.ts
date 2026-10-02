import { catalogSourcesResponseSchema } from "@dnd/catalog";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";

/**
 * Each source abbreviation's title, such as `PHB` to `Player's Handbook (2014)`. Titles
 * change only when the catalog is rebuilt, so one fetch serves the session and a reload
 * picks up a rebuild's. A failed fetch leaves every chip on its abbreviation, so it is not
 * retried.
 */
export function useSourceNames() {
  return useQuery({
    queryKey: ["catalog", "sources"],
    queryFn: async () =>
      new Map(
        (await apiGet("/catalog/sources", catalogSourcesResponseSchema)).sources.map(
          ({ source, name }) => [source, name],
        ),
      ),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}
