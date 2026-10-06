import {
  type CharacterDefinition,
  type CharacterRecord,
  characterRecordSchema,
} from "@dnd/character";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiMutate } from "../lib/api.ts";
import {
  characterDefinitionWriteKey,
  characterDefinitionWriteScope,
  characterKey,
  charactersKey,
} from "./characterKeys.ts";

export type DefinitionEdit = (definition: CharacterDefinition) => CharacterDefinition;

/**
 * Applies an edit to a character's definition and writes the result. The edit runs when
 * the write starts, against the definition in the detail cache, and writes queue in one
 * scope: two fields saving at once each land on the other's result rather than over it.
 *
 * On success the mutation writes the response straight into the detail cache and
 * invalidates by prefix, which refetches the list, the derived block, the inventory and
 * the undo log keyed under the character; a grip written from a row reaches its damage
 * chip that way. On failure the caches stay untouched and a view renders the mutation's
 * own `error` — TanStack Query never resolves a failed write as data.
 */
export function useUpdateCharacterDefinition(id: string) {
  const queryClient = useQueryClient();

  return useMutation<CharacterRecord, Error, DefinitionEdit>({
    mutationKey: characterDefinitionWriteKey(id),
    scope: { id: characterDefinitionWriteScope(id) },
    mutationFn: (edit) => {
      const record = queryClient.getQueryData<CharacterRecord>(characterKey(id));
      if (!record) throw new Error("The character has not loaded yet.");
      return apiMutate("PUT", `/characters/${id}`, characterRecordSchema, edit(record.definition));
    },
    onSuccess: (record) => {
      queryClient.setQueryData(characterKey(id), record);
      queryClient.invalidateQueries({ queryKey: charactersKey });
    },
  });
}
