import { subraceListItemSchema, type subraceRecordSchema } from "@dnd/catalog";
import type { CharacterRecord, ContentRef } from "@dnd/character";
import { skipToken, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

// A homebrew subrace is not yet a pick, so only the catalog rows pass through.
const subraceListSchema = z
  .object({ items: z.array(subraceListItemSchema), total: z.int() })
  .transform(({ items, total }) => ({
    items: items.filter((item): item is z.infer<typeof subraceRecordSchema> => "source" in item),
    total,
  }));

/**
 * Every subrace of one catalog race in one edition, each row already merged with its race.
 * 200 is the route's ceiling, far past the most subraces any upstream race carries.
 */
export function useSubraces(race: ContentRef | undefined, edition: CharacterRecord["edition"]) {
  return useQuery({
    queryKey: ["races", race?.name, race?.source, "subraces", edition],
    queryFn: race
      ? () =>
          apiGet(
            `/races/${encodeURIComponent(race.name)}/${encodeURIComponent(race.source)}/subraces?edition=${edition}&limit=200`,
            subraceListSchema,
          )
      : skipToken,
    retry: retryUnlessClientError,
  });
}
