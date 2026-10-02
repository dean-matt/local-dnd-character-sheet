import type { CharacterRecord } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import type { CatalogIndex } from "../lib/catalogIndexes.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

/** One page of a catalog type's list route, within one edition. */
export function useCatalogIndex(
  index: CatalogIndex,
  edition: CharacterRecord["edition"],
  offset: number,
  limit: number,
) {
  const params = new URLSearchParams({ edition, limit: String(limit), offset: String(offset) });
  return useQuery({
    queryKey: ["catalog-index", index.collection, edition, offset, limit],
    queryFn: () => apiGet(`/${index.collection}?${params}`, index.schema),
    retry: retryUnlessClientError,
  });
}
