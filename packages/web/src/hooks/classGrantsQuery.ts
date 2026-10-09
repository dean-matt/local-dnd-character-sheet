import { classGrantsSchema } from "@dnd/catalog";
import type { ContentRef } from "@dnd/character";
import { queryOptions, skipToken } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

/** The query for what a catalog class grants by `level`, which fetches nothing while `cls` is absent. */
export const classGrantsQuery = (cls: ContentRef | undefined, level: number) =>
  queryOptions({
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
