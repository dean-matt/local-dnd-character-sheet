import { grantedSpellsSchema, type SpellGrantor } from "@dnd/catalog";
import type { ContentRef } from "@dnd/character";
import { useQueries } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

/** One row that can grant spells, and the level it is read at. */
export type SpellGrantorRef = {
  grantor: SpellGrantor;
  ref: ContentRef;
  /** A subclass's class or a subrace's race. */
  parent?: ContentRef;
  level: number;
};

/**
 * The spells each grantor gives outright by its level and whether it offers a pick, in the
 * order `grantors` lists them, or `undefined` until every one has loaded, and whether any
 * request failed.
 */
export function useGrantedSpells(grantors: readonly SpellGrantorRef[]) {
  return useQueries({
    queries: grantors.map(({ grantor, ref, parent, level }) => {
      const params = new URLSearchParams({
        grantor,
        name: ref.name,
        source: ref.source,
        level: String(level),
        ...(parent && { parentName: parent.name, parentSource: parent.source }),
      });
      return {
        queryKey: ["spells", "granted", params.toString()],
        queryFn: () => apiGet(`/spells/granted?${params}`, grantedSpellsSchema),
        retry: retryUnlessClientError,
      };
    }),
    combine: (results) => ({
      lists: results.every((result) => result.data !== undefined)
        ? results.map((result) => result.data ?? { spells: [], picks: { cantrips: 0, spells: 0 } })
        : undefined,
      failed: results.some((result) => result.isError),
    }),
  });
}
