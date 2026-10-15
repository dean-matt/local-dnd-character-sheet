import type { CharacterRecord } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { classSpellListQuery } from "./classSpellListQuery.ts";

type Ref = { name: string; source: string };

/**
 * The `searchHitKey` of every spell `list` holds, as `classSpellListQuery` reads it. A
 * picker offering every spell reads it to say which ones the class cannot take.
 */
export function useClassSpellList(
  edition: CharacterRecord["edition"],
  list: { class: Ref; subclass?: Ref; level: number } | undefined,
  minLevel: number | undefined = 0,
) {
  return useQuery(classSpellListQuery(edition, list, minLevel));
}
