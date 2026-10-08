import type { CharacterRecord } from "@dnd/character";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiDelete } from "../lib/api.ts";
import { characterKey, charactersKey } from "./characterKeys.ts";

/**
 * Deletes the character. On success it drops every query under the character's key, its
 * pages, state and undo log among them, and takes it out of the list before that refetches.
 */
export function useDeleteCharacter(id: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: () => apiDelete(`/characters/${id}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: characterKey(id) });
      queryClient.setQueryData<CharacterRecord[]>(charactersKey, (list) =>
        list?.filter((character) => character.id !== id),
      );
      queryClient.invalidateQueries({ queryKey: charactersKey, exact: true });
    },
  });
}
