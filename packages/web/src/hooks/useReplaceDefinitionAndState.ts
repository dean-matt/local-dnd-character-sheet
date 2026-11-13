import {
  type CharacterDefinition,
  type CharacterRecord,
  type CharacterStateRecord,
  characterRecordSchema,
  characterStateRecordSchema,
  type RollRecord,
} from "@dnd/character";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiMutate } from "../lib/api.ts";
import {
  characterKey,
  characterStateKey,
  characterStateWriteKey,
  charactersKey,
  characterWriteScope,
} from "./characterKeys.ts";
import type { StateWrite } from "./useReplaceCharacterState.ts";

const bothSchema = z.strictObject({
  character: characterRecordSchema,
  state: characterStateRecordSchema,
});

/** A new state and an edit that run when the write starts against the cache. */
export interface DefinitionAndState {
  state: StateWrite;
  edit: (definition: CharacterDefinition) => CharacterDefinition;
  /** A roll logged in the same write, which undoing the entry deletes. */
  roll?: RollRecord;
}

/**
 * Writes a definition edit and a whole state in one request, which the server records as one
 * undo entry. It queues with the other writes and counts as a state write, so `writing`
 * from `useReplaceCharacterState` is true while it is in flight. A failure writes neither.
 */
export function useReplaceDefinitionAndState(id: string) {
  const queryClient = useQueryClient();
  return useMutation<z.infer<typeof bothSchema>, Error, DefinitionAndState>({
    mutationKey: characterStateWriteKey(id),
    scope: { id: characterWriteScope(id) },
    mutationFn: ({ state, edit, roll }) => {
      const record = queryClient.getQueryData<CharacterRecord>(characterKey(id));
      const play = queryClient.getQueryData<CharacterStateRecord>(characterStateKey(id));
      if (!record || !play) throw new Error("The character has not loaded yet.");
      return apiMutate("PUT", `/characters/${id}/definition-and-state`, bothSchema, {
        definition: edit(record.definition),
        state: typeof state === "function" ? state(play.state) : state,
        roll,
      });
    },
    onSuccess: ({ character, state }) => {
      queryClient.setQueryData(characterKey(id), character);
      queryClient.setQueryData(characterStateKey(id), state);
      queryClient.invalidateQueries({ queryKey: charactersKey });
    },
  });
}
