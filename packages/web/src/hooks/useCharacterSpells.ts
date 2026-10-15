import { characterSpellsSchema } from "@dnd/catalog";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";
import { characterSpellsKey } from "./characterKeys.ts";

/** A character's spells, keyed under the character so a definition write refetches them. */
export function useCharacterSpells(id: string) {
  return useQuery({
    queryKey: characterSpellsKey(id),
    queryFn: () => apiGet(`/characters/${id}/spells`, characterSpellsSchema),
    enabled: id.length > 0,
    retry: retryUnlessClientError,
  });
}
