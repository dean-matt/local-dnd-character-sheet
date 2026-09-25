import { characterDerivedSchema } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { characterKey } from "./useCharacters.ts";

/**
 * A character's derived block. Keyed under the character, so a definition write that
 * invalidates `characters` recomputes it too.
 */
export function useCharacterDerived(id: string) {
  return useQuery({
    queryKey: [...characterKey(id), "derived"],
    queryFn: () => apiGet(`/characters/${id}/derived`, characterDerivedSchema),
    enabled: id.length > 0,
  });
}
