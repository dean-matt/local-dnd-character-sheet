import { type CharacterRecord, characterRecordSchema, type undoLogSchema } from "@dnd/character";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { apiMutate } from "../lib/api.ts";
import {
  characterDefinitionWriteScope,
  characterKey,
  charactersKey,
  characterUndoKey,
  characterUndoWriteKey,
} from "./characterKeys.ts";

/**
 * Undo back to entry `to`, refused where the log's head is no longer `newest` or the
 * character was written after `readAt`, its `updatedAt` as last read.
 */
export interface UndoBackTo {
  to: number;
  newest: number;
  readAt: string;
}

/**
 * Restores the character's newest undo entry, or with a target every entry back to and
 * including `to`. On success it lands in the detail cache the way a definition write
 * does, and the prefix invalidation refetches the undo log, the play state and every block
 * derived from the definition. The undo stays pending until that refetch settles, so a
 * state control waiting on it never writes over the restored state with the one it held. The log drops the undone entries at once, so a second press before
 * that refetch names, and undoes, the entry behind them. A failure refetches the
 * character and the log, since a refused snapshot is dropped on the server and a refused
 * target means either moved on.
 */
export function useUndoCharacterChange(id: string) {
  const queryClient = useQueryClient();

  return useMutation<CharacterRecord, Error, UndoBackTo | undefined>({
    mutationKey: characterUndoWriteKey(id),
    scope: { id: characterDefinitionWriteScope(id) },
    mutationFn: (target) =>
      apiMutate(
        "POST",
        `/characters/${id}/undo`,
        characterRecordSchema,
        target ? { to: target.to, newest: target.newest } : {},
        target && { "If-Unmodified-Since": new Date(target.readAt).toUTCString() },
      ),
    onSuccess: (record, target) => {
      queryClient.setQueryData(characterKey(id), record);
      queryClient.setQueryData<z.infer<typeof undoLogSchema>>(characterUndoKey(id), (log) =>
        target ? log?.filter((entry) => entry.id < target.to) : log?.slice(1),
      );
      return queryClient.invalidateQueries({ queryKey: charactersKey });
    },
    onError: () => queryClient.invalidateQueries({ queryKey: characterKey(id) }),
  });
}
