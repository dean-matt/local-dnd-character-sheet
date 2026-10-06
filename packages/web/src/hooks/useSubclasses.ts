import { subclassRecordSchema } from "@dnd/catalog";
import type { CharacterRecord, ContentRef } from "@dnd/character";
import { skipToken, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

const subclassListSchema = z.object({ items: z.array(subclassRecordSchema), total: z.int() });

/**
 * Every subclass of one catalog class in one edition. 200 is the route's ceiling, past
 * the 19 that the most-served class carries.
 */
export function useSubclasses(cls: ContentRef | undefined, edition: CharacterRecord["edition"]) {
  return useQuery({
    queryKey: ["classes", cls?.name, cls?.source, "subclasses", edition],
    queryFn: cls
      ? () =>
          apiGet(
            `/classes/${encodeURIComponent(cls.name)}/${encodeURIComponent(cls.source)}/subclasses?edition=${edition}&limit=200`,
            subclassListSchema,
          )
      : skipToken,
    retry: retryUnlessClientError,
  });
}
