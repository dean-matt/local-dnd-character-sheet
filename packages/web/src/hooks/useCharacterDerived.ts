import { characterDerivedSchema } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { ApiError, apiGet } from "../lib/api.ts";
import { characterKey } from "./useCharacters.ts";

/**
 * A character's derived block. Keyed under the character, so a definition write that
 * invalidates `characters` recomputes it too. A 4xx is an answer a retry cannot change —
 * a 422 names a class or race that resolves to nothing — so it surfaces at once.
 */
export function useCharacterDerived(id: string) {
  return useQuery({
    queryKey: [...characterKey(id), "derived"],
    queryFn: () => apiGet(`/characters/${id}/derived`, characterDerivedSchema),
    enabled: id.length > 0,
    retry: (failures, error) =>
      !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failures < 3,
  });
}
