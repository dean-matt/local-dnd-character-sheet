import { type CharacterRecord, characterRecordSchema } from "@dnd/character";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiMutate } from "../lib/api.ts";
import { characterKey, charactersKey } from "./characterKeys.ts";

/**
 * Sends a character file to the API, which validates it and creates a new character. A
 * file that is not JSON fails here, before any request. The response seeds the detail
 * cache and the list refetches, as a create does.
 */
export function useImportCharacter() {
  const queryClient = useQueryClient();

  return useMutation<CharacterRecord, Error, File>({
    mutationFn: async (file) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        throw new Error(`${file.name} is not a JSON file.`);
      }
      return apiMutate("POST", "/characters/import", characterRecordSchema, parsed);
    },
    onSuccess: (record) => {
      queryClient.setQueryData(characterKey(record.id), record);
      queryClient.invalidateQueries({ queryKey: charactersKey, exact: true });
    },
  });
}
