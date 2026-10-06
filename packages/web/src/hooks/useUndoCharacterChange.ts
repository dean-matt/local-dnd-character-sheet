import { type CharacterRecord, characterRecordSchema, type undoLogSchema } from "@dnd/character";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { apiMutate } from "../lib/api.ts";
import {
  characterDefinitionWriteKey,
  characterDefinitionWriteScope,
  characterKey,
  charactersKey,
  characterUndoKey,
} from "./characterKeys.ts";

/**
 * Restores the character's newest undo entry. On success it lands in the detail cache the
 * way a definition write does, and the prefix invalidation refetches the undo log and
 * every block derived from the definition. The log drops its head at once, so a second
 * press before that refetch names, and undoes, the entry behind it. A failure refetches
 * the log too, since a refused snapshot is dropped on the server.
 */
export function useUndoCharacterChange(id: string) {
  const queryClient = useQueryClient();

  return useMutation<CharacterRecord, Error, void>({
    mutationKey: characterDefinitionWriteKey(id),
    scope: { id: characterDefinitionWriteScope(id) },
    mutationFn: () => apiMutate("POST", `/characters/${id}/undo`, characterRecordSchema, {}),
    onSuccess: (record) => {
      queryClient.setQueryData(characterKey(id), record);
      queryClient.setQueryData<z.infer<typeof undoLogSchema>>(characterUndoKey(id), (log) =>
        log?.slice(1),
      );
      queryClient.invalidateQueries({ queryKey: charactersKey });
    },
    onError: () => queryClient.invalidateQueries({ queryKey: characterUndoKey(id) }),
  });
}
