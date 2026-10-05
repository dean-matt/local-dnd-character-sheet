import { searchTypesResponseSchema } from "@dnd/catalog";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

/** Every kind of row `/search` can return, which the Mechanics menu and the search page list. */
export function useSearchTypes() {
  return useQuery({
    queryKey: ["search", "types"],
    queryFn: async () => (await apiGet("/search/types", searchTypesResponseSchema)).types,
    staleTime: Number.POSITIVE_INFINITY,
    retry: retryUnlessClientError,
  });
}
