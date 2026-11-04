import { subclassListItemSchema } from "@dnd/catalog";
import type { CharacterRecord, ContentRef } from "@dnd/character";
import { queryOptions, skipToken } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

const subclassListSchema = z.object({ items: z.array(subclassListItemSchema), total: z.int() });

/**
 * The query for every subclass of one class in one edition, the catalog's and the homebrew's
 * together; a homebrew class is named by its name and `HB`, and read in its own edition, since
 * its name is unique only within one. 200 is the route's ceiling, past the 19 that the
 * most-served class carries.
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
