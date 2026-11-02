import { subclassListItemSchema, type subclassRecordSchema } from "@dnd/catalog";
import type { CharacterRecord, ContentRef } from "@dnd/character";
import { queryOptions, skipToken } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

// A homebrew subclass is not yet a pick, so only the catalog rows pass through.
const subclassListSchema = z
  .object({ items: z.array(subclassListItemSchema), total: z.int() })
  .transform(({ items, total }) => ({
    items: items.filter((item): item is z.infer<typeof subclassRecordSchema> => "source" in item),
    total,
  }));

/**
 * The query for every subclass of one catalog class in one edition. 200 is the route's
 * ceiling, past the 19 that the most-served class carries.
 */
export const subclassesQuery = (cls: ContentRef | undefined, edition: CharacterRecord["edition"]) =>
  queryOptions({
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
