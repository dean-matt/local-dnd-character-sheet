import { backgroundRecordSchema } from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

const backgroundListSchema = z.object({ items: z.array(backgroundRecordSchema), total: z.int() });

/**
 * Every catalog background in one edition, whole, so a picker can say what each grants
 * before one is chosen. 200 is the route's ceiling, about twice the 101 the larger
 * edition holds; past it, the rows beyond show no grants until this pages.
 */
export function useBackgrounds(edition: CharacterRecord["edition"]) {
  return useQuery({
    queryKey: ["backgrounds", edition],
    queryFn: () => apiGet(`/backgrounds?edition=${edition}&limit=200`, backgroundListSchema),
    retry: retryUnlessClientError,
  });
}
