import type { ContentRef } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { subclassGrantsQuery } from "./subclassGrantsQuery.ts";

/** What a catalog subclass grants by `level`, or nothing fetched while either ref is absent. */
export function useSubclassGrants(
  cls: ContentRef | undefined,
  subclass: ContentRef | undefined,
  level: number,
) {
  return useQuery(subclassGrantsQuery(cls, subclass, level));
}
