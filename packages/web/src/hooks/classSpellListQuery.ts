import { searchResponseSchema } from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import { queryOptions, skipToken } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";
import { searchHitKey } from "../lib/searchHitKey.ts";
import { spellListFilters } from "../lib/spellListFilters.ts";

type Ref = { name: string; source: string };

/** `/search`'s largest page. */
const PAGE = 200;

/**
 * The query for the `searchHitKey` of every spell `list` holds in `edition` from spell level
 * `minLevel` up, with the subclass's additions at the class level `list.level`. Pages
 * through `/search`, since the largest list, the 2024 Wizard's, holds 369 spells. Fetches
 * nothing where `list` or `minLevel` is `undefined`.
 */
export const classSpellListQuery = (
  edition: CharacterRecord["edition"],
  list: { class: Ref; subclass?: Ref; level: number } | undefined,
  minLevel: number | undefined = 0,
) =>
  queryOptions({
    queryKey: ["search", "class-spells", edition, list, minLevel],
    queryFn:
      list === undefined || minLevel === undefined
        ? skipToken
        : async () => {
            const keys = new Set<string>();
            for (let offset = 0; ; offset += PAGE) {
              const params = new URLSearchParams({
                edition,
                type: "spell",
                limit: String(PAGE),
                offset: String(offset),
                minLevel: String(minLevel),
                ...spellListFilters(list),
              });
              const page = await apiGet(`/search?${params}`, searchResponseSchema);
              for (const hit of page.items) keys.add(searchHitKey(hit));
              if (page.items.length === 0 || offset + PAGE >= page.total) return keys;
            }
          },
    retry: retryUnlessClientError,
  });
