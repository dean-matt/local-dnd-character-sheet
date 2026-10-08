import { type CharacterRecord, characterRecordSchema } from "@dnd/character";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiMutate } from "../lib/api.ts";
import { characterKey, charactersKey } from "./characterKeys.ts";

/**
 * Copies the character under a new id. The response seeds the copy's detail cache, so the
 * sheet a caller navigates to opens without a second read, and the list refetches to include it.
 */
export function useDuplicateCharacter(id: string) {
  const queryClient = useQueryClient();

  return useMutation<CharacterRecord, Error, void>({
    mutationFn: () =>
      apiMutate("POST", `/characters/${id}/duplicate`, characterRecordSchema, undefined),
    onSuccess: (record) => {
      queryClient.setQueryData(characterKey(record.id), record);
      queryClient.invalidateQueries({ queryKey: charactersKey, exact: true });
    },
  });
}
