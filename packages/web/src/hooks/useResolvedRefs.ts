import { type RefQuery, refResolveResponseSchema } from "@dnd/catalog";
import { useQuery } from "@tanstack/react-query";
import { apiMutate, retryUnlessClientError } from "../lib/api.ts";

/**
 * The catalog row each of one block's references names, `null` where there is none, in
 * the order `refs` lists them. A `POST` that reads nothing but the catalog, so it is a
 * query and caches like one.
 */
export function useResolvedRefs(refs: RefQuery[]) {
  return useQuery({
    queryKey: ["refs", refs],
    queryFn: async () =>
      (await apiMutate("POST", "/refs/resolve", refResolveResponseSchema, { refs })).refs,
    enabled: refs.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
    retry: retryUnlessClientError,
  });
}
