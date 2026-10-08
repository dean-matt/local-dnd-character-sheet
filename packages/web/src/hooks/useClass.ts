import { classRecordSchema } from "@dnd/catalog";
import type { ContentRef } from "@dnd/character";
import { queryOptions, skipToken, useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

/** The query for one catalog class, which fetches nothing while `ref` is absent. */
export const classQuery = (ref: ContentRef | undefined) =>
  queryOptions({
    queryKey: ["classes", ref?.name, ref?.source],
    queryFn: ref
      ? () =>
          apiGet(
            `/classes/${encodeURIComponent(ref.name)}/${encodeURIComponent(ref.source)}`,
            classRecordSchema,
          )
      : skipToken,
    retry: retryUnlessClientError,
  });

/** One catalog class, or nothing fetched while `ref` is absent. */
export const useClass = (ref: ContentRef | undefined) => useQuery(classQuery(ref));
