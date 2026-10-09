import { featRecordSchema } from "@dnd/catalog";
import type { CharacterDefinition } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

const featListSchema = z.object({ items: z.array(featRecordSchema), total: z.int() });

/**
 * Every catalog feat in one edition, whole, so a picker can read each one's prerequisites
 * and increases. 200 is the route's ceiling, over the 171 the larger edition holds; past
 * it, the feats beyond go unoffered until this pages.
 */
export function useFeats(edition: CharacterDefinition["edition"]) {
  return useQuery({
    queryKey: ["feats", edition],
    queryFn: () => apiGet(`/feats?edition=${edition}&limit=200`, featListSchema),
    retry: retryUnlessClientError,
  });
}
