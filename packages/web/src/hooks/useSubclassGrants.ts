import { classGrantsSchema } from "@dnd/catalog";
import type { ContentRef } from "@dnd/character";
import { skipToken, useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

/** What a catalog subclass grants by `level`, or nothing fetched while either ref is absent. */
export function useSubclassGrants(
  cls: ContentRef | undefined,
  subclass: ContentRef | undefined,
  level: number,
) {
  const at = (part: string) => encodeURIComponent(part);
  const path =
    cls &&
    subclass &&
    `${at(cls.name)}/${at(cls.source)}/subclasses/${at(subclass.name)}/${at(subclass.source)}`;
  return useQuery({
    queryKey: [
      "classes",
      cls?.name,
      cls?.source,
      "subclasses",
      subclass?.name,
      subclass?.source,
      "at",
      level,
    ],
    queryFn: path ? () => apiGet(`/classes/${path}/at/${level}`, classGrantsSchema) : skipToken,
    retry: retryUnlessClientError,
  });
}
