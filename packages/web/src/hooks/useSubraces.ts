import { subraceListItemSchema } from "@dnd/catalog";
import type { CharacterRecord, ContentRef } from "@dnd/character";
import { skipToken, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

const subraceListSchema = z.object({ items: z.array(subraceListItemSchema), total: z.int() });

/**
 * Every subrace of one race in one edition, catalog and homebrew together. A catalog row is
 * already merged with its race; a homebrew one holds only what it adds. A homebrew race is
 * named by its name and source `HB`. 200 is the route's ceiling, far past the most subraces
 * any upstream race carries.
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
