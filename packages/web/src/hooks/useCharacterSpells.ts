import { characterSpellsSchema } from "@dnd/catalog";
import { useQuery } from "@tanstack/react-query";
import { apiGet, retryUnlessClientError } from "../lib/api.ts";
import { characterKey } from "./useCharacters.ts";

/** A character's spells, keyed under the character so a definition write refetches them. */
export function useCharacterSpells(id: string) {
  return useQuery({
    queryKey: [...characterKey(id), "spells"],
    queryFn: () => apiGet(`/characters/${id}/spells`, characterSpellsSchema),
    enabled: id.length > 0,
    retry: retryUnlessClientError,
  });
}
