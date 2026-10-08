import { type SpellLookupRequest, spellLookupResponseSchema } from "@dnd/catalog";
import { entryKey } from "@dnd/character";
import { useQueries } from "@tanstack/react-query";
import { apiMutate } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

/**
 * Each spell's name and level, whether `context`'s list holds it and whether its rows
 * offer it, in the order `spells` lists them — `null` where no row answers, `undefined`
 * while it loads — and whether any request failed. One request a spell, so a pick added
 * or removed leaves the others' answers cached. A `POST` that writes nothing, so it is a
 * query.
 */
export function useSpellLookup(
  spells: SpellLookupRequest["spells"],
  context: Omit<SpellLookupRequest, "spells">,
) {
  return useQueries({
    queries: spells.map((ref) => ({
      queryKey: ["spells", "lookup", entryKey(ref), context],
      queryFn: async () => {
        const request = { spells: [ref], ...context };
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
