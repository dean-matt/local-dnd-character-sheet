import {
  type CharacterDefinition,
  type CharacterRecord,
  characterRecordSchema,
} from "@dnd/character";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiMutate } from "../lib/api.ts";
import { characterKey, charactersKey } from "./characterKeys.ts";

/**
 * Writes a new character. The response seeds the detail cache, so the sheet a caller
 * navigates to opens without a second read, and the list refetches to include it.
 */
export function useCreateCharacter() {
  const queryClient = useQueryClient();

  return useMutation<CharacterRecord, Error, CharacterDefinition>({
    mutationFn: (definition) => apiMutate("POST", "/characters", characterRecordSchema, definition),
    onSuccess: (record) => {
      queryClient.setQueryData(characterKey(record.id), record);
      queryClient.invalidateQueries({ queryKey: charactersKey, exact: true });
    },
  });
}
