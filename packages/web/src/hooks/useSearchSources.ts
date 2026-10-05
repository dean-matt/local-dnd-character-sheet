import { searchSourcesResponseSchema } from "@dnd/catalog";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

/** Every source `/search` can return a row from, which Settings turns on and off. */
export function useSearchSources() {
  return useQuery({
    queryKey: ["search", "sources"],
    queryFn: async () => (await apiGet("/search/sources", searchSourcesResponseSchema)).sources,
    retry: retryUnlessClientError,
  });
}
