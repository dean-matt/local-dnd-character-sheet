import { searchResponseSchema } from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";
import { searchHitKey } from "../lib/searchHitKey.ts";
import { spellListFilters } from "../lib/spellListFilters.ts";

type Ref = { name: string; source: string };

/** `/search`'s largest page. */
const PAGE = 200;

/**
 * The `searchHitKey` of every spell `list` holds in `edition`, the subclass's additions at
 * the class level `list.level` among them. A picker offering every spell reads it to say
 * which ones the class cannot take. Pages through `/search`, since the largest list, the
 * 2024 Wizard's, holds 369 spells; `undefined` while it loads or where `list` is.
 */
export function useClassSpellList(
  edition: CharacterRecord["edition"],
  list: { class: Ref; subclass?: Ref; level: number } | undefined,
) {
  return useQuery({
    queryKey: ["search", "class-spells", edition, list],
    queryFn: async () => {
      const keys = new Set<string>();
      for (let offset = 0; ; offset += PAGE) {
        const params = new URLSearchParams({
          edition,
          type: "spell",
          limit: String(PAGE),
          offset: String(offset),
          ...spellListFilters(list),
        });
        const page = await apiGet(`/search?${params}`, searchResponseSchema);
        for (const hit of page.items) keys.add(searchHitKey(hit));
        if (page.items.length === 0 || offset + PAGE >= page.total) return keys;
      }
    },
    enabled: list !== undefined,
    retry: retryUnlessClientError,
  });
}
