import { characterReferencesSchema } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { apiGet, retryUnlessClientError } from "../lib/api.ts";
import { characterKey } from "./useCharacters.ts";

/**
 * A character's catalog references that no row answers, keyed under the character so a
 * definition write refetches them. Only a row already shown unresolved asks for it.
 */
export function useCharacterReferences(id: string) {
  return useQuery({
    queryKey: [...characterKey(id), "references"],
    queryFn: () => apiGet(`/characters/${id}/references`, characterReferencesSchema),
    enabled: id.length > 0,
    retry: retryUnlessClientError,
  });
}
