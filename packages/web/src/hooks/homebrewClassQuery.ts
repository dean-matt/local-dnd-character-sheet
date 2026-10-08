import { homebrewClassRecordSchema } from "@dnd/catalog";
import { queryOptions, skipToken } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

export const homebrewClassKey = (id: string | undefined) => ["homebrew", "classes", id];

/** The query for one homebrew class, which fetches nothing while `id` is absent. */
export const homebrewClassQuery = (id: string | undefined) =>
  queryOptions({
    queryKey: homebrewClassKey(id),
    queryFn: id
      ? () => apiGet(`/homebrew/classes/${encodeURIComponent(id)}`, homebrewClassRecordSchema)
      : skipToken,
    retry: retryUnlessClientError,
  });
