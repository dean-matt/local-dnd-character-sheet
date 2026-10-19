import { type SpellLookupRequest, spellLookupResponseSchema } from "@dnd/catalog";
import { entryKey } from "@dnd/character";
import { useQueries } from "@tanstack/react-query";
import { apiMutate } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

/**
 * Each spell's name and level and whether the list or offer `contextOf` names for it holds
 * it, in the order `spells` lists them — `null` where no row answers, `undefined` while it
 * loads — and whether any request failed. One request a spell, so a pick added or removed
 * leaves the others' answers cached. A `POST` that writes nothing, so it is a query.
 */
export function useSpellLookup(
  spells: SpellLookupRequest["spells"],
  contextOf: (index: number) => Omit<SpellLookupRequest, "spells">,
) {
  return useQueries({
    queries: spells.map((ref, index) => ({
      queryKey: ["spells", "lookup", entryKey(ref), contextOf(index)],
      queryFn: async () => {
        const request = { spells: [ref], ...contextOf(index) };
        const found = await apiMutate("POST", "/spells/lookup", spellLookupResponseSchema, request);
        return found.spells[0] ?? null;
      },
      retry: retryUnlessClientError,
    })),
    combine: (results) => ({
      looked: results.map((result) => result.data),
      failed: results.some((result) => result.isError),
    }),
  });
}
