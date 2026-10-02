import { skipToken, useQuery } from "@tanstack/react-query";
import type { matchCatalogTarget } from "../lib/catalogRows.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

/** The row a matched detail address names; never fetched for an address that matched nothing. */
export function useCatalogRow(match: ReturnType<typeof matchCatalogTarget>) {
  return useQuery({
    queryKey: ["catalog", match?.target.path, match?.key],
    queryFn: match ? () => match.target.load(match.key) : skipToken,
    retry: retryUnlessClientError,
  });
}
