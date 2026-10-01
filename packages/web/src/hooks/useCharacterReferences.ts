import { characterReferencesSchema } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { apiGet, retryUnlessClientError } from "../lib/api.ts";
import { characterKey } from "./useCharacters.ts";

/**
 * A character's catalog references that no row answers, keyed under the character so a
 * definition write refetches them.
 */
export function useCharacterReferences(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...characterKey(id), "references"],
    queryFn: () => apiGet(`/characters/${id}/references`, characterReferencesSchema),
    enabled: enabled && id.length > 0,
    retry: retryUnlessClientError,
  });
}
