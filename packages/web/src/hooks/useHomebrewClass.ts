import { homebrewClassRecordSchema } from "@dnd/catalog";
import { skipToken, useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

export const homebrewClassKey = (id: string | undefined) => ["homebrew", "classes", id];

/** One homebrew class, or nothing fetched while `id` is absent. */
export function useHomebrewClass(id: string | undefined) {
  return useQuery({
    queryKey: homebrewClassKey(id),
    queryFn: id
      ? () => apiGet(`/homebrew/classes/${encodeURIComponent(id)}`, homebrewClassRecordSchema)
      : skipToken,
    retry: retryUnlessClientError,
  });
}
