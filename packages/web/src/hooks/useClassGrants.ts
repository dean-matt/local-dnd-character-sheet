import type { ContentRef } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { classGrantsQuery } from "./classGrantsQuery.ts";

/** What a catalog class grants by `level`, or nothing fetched while `cls` is absent. */
export function useClassGrants(cls: ContentRef | undefined, level: number) {
  return useQuery(classGrantsQuery(cls, level));
}
