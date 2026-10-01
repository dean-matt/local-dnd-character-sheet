import {
  type CharacterDefinition,
  type CharacterRecord,
  characterRecordSchema,
} from "@dnd/character";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiMutate } from "../lib/api.ts";
import { characterKey, charactersKey } from "./characterKeys.ts";

/**
 * Replaces a character's definition. On success the mutation writes the response
 * straight into the detail cache and invalidates the list, so a reader sees the write
 * on the character's own page without waiting on a refetch. The invalidation is by
 * prefix, which also refetches the derived block and the inventory keyed under the
 * character; a grip written from a row reaches its damage chip that way. On failure both
 * caches stay untouched and a view renders the mutation's own `error` — TanStack Query
 * never resolves a failed write as data.
 */
export function useUpdateCharacterDefinition(id: string) {
  const queryClient = useQueryClient();

  return useMutation<CharacterRecord, Error, CharacterDefinition>({
    mutationFn: (definition) =>
      apiMutate("PUT", `/characters/${id}`, characterRecordSchema, definition),
    onSuccess: (record) => {
      queryClient.setQueryData(characterKey(id), record);
      queryClient.invalidateQueries({ queryKey: charactersKey });
    },
  });
}
