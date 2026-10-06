import { raceRecordSchema } from "@dnd/catalog";
import type { ContentRef } from "@dnd/character";
import { skipToken, useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

/** One catalog race, or nothing fetched while `ref` is absent. */
export function useRace(ref: ContentRef | undefined) {
  return useQuery({
    queryKey: ["races", ref?.name, ref?.source],
    queryFn: ref
      ? () =>
          apiGet(
            `/races/${encodeURIComponent(ref.name)}/${encodeURIComponent(ref.source)}`,
            raceRecordSchema,
          )
      : skipToken,
    retry: retryUnlessClientError,
  });
}
