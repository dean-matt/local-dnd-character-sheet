import { classGrantsSchema } from "@dnd/catalog";
import type { ContentRef } from "@dnd/character";
import { skipToken, useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

/** What a catalog class grants by `level`, or nothing fetched while `cls` is absent. */
export function useClassGrants(cls: ContentRef | undefined, level: number) {
  return useQuery({
    queryKey: ["classes", cls?.name, cls?.source, "at", level],
    queryFn: cls
      ? () =>
          apiGet(
            `/classes/${encodeURIComponent(cls.name)}/${encodeURIComponent(cls.source)}/at/${level}`,
            classGrantsSchema,
          )
      : skipToken,
    retry: retryUnlessClientError,
  });
}
