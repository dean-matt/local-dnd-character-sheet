import { type RefQuery, refResolveResponseSchema } from "@dnd/catalog";
import { useQuery } from "@tanstack/react-query";
import { apiMutate, retryUnlessClientError } from "../lib/api.ts";

/**
 * The catalog or homebrew row each of one block's references names, `null` where there
 * is none, in the order `refs` lists them. A `POST` that writes nothing, so it is a query.
 * It keeps TanStack's default staleness, because a homebrew row can be renamed or deleted
 * while a sheet is open and its tag must then degrade rather than keep the old row. That
 * costs one request per block on every mount and focus; a longer `staleTime`, or
 * invalidating `["refs"]` once the web writes homebrew, is the way out.
 */
export function useResolvedRefs(refs: RefQuery[]) {
  return useQuery({
    queryKey: ["refs", refs],
    queryFn: async () =>
      (await apiMutate("POST", "/refs/resolve", refResolveResponseSchema, { refs })).refs,
    enabled: refs.length > 0,
    retry: retryUnlessClientError,
  });
}
