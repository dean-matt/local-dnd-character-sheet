import { classRecordSchema } from "@dnd/catalog";
import type { ContentRef } from "@dnd/character";
import { skipToken, useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

/** One catalog class, or nothing fetched while `ref` is absent. */
export function useClass(ref: ContentRef | undefined) {
  return useQuery({
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
}
