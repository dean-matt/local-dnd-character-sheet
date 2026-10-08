import { type SpellLookupRequest, spellLookupResponseSchema } from "@dnd/catalog";
import { entryKey } from "@dnd/character";
import { useQueries } from "@tanstack/react-query";
import { apiMutate } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

/**
 * Each spell's name and level, and whether `list` holds it, in the order `spells` lists
 * them: `null` where no row answers, and `undefined` while it loads. One request a spell,
 * so a pick added or removed leaves the others' answers cached. A `POST` that writes
 * nothing, so it is a query.
 */
export function useSpellLookup(
  spells: SpellLookupRequest["spells"],
  list?: SpellLookupRequest["list"],
) {
  return useQueries({
    queries: spells.map((ref) => ({
      queryKey: ["spells", "lookup", entryKey(ref), list],
      queryFn: async () => {
        const request = { spells: [ref], ...(list && { list }) };
        const found = await apiMutate("POST", "/spells/lookup", spellLookupResponseSchema, request);
        return found.spells[0] ?? null;
      },
      retry: retryUnlessClientError,
    })),
    combine: (results) => results.map((result) => result.data),
  });
}
