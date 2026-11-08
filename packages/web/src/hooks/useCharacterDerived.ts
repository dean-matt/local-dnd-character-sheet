import { characterDerivedSchema } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";
import { characterDerivedKey } from "./characterKeys.ts";

/**
 * A character's derived block. Keyed under the character, so a definition write that
 * invalidates `characters` recomputes it too, as does a state write, since a rage shapes it. A 422 names a class or race that resolves
 * to nothing, which no retry changes.
 */
export function useCharacterDerived(id: string) {
  return useQuery({
    queryKey: characterDerivedKey(id),
    queryFn: () => apiGet(`/characters/${id}/derived`, characterDerivedSchema),
    enabled: id.length > 0,
    retry: retryUnlessClientError,
  });
}
