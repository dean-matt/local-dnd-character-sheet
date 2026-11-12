import {
  type CharacterState,
  type CharacterStateRecord,
  characterStateRecordSchema,
} from "@dnd/character";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiMutate } from "../lib/api.ts";
import {
  characterDerivedKey,
  characterStateKey,
  characterStateWriteKey,
  characterUndoKey,
  characterUndoWriteKey,
  characterWriteScope,
} from "./characterKeys.ts";

/** A whole state, or an edit that runs when the write starts against the state in the cache. */
export type StateWrite = CharacterState | ((latest: CharacterState) => CharacterState);

/**
 * Replaces a character's whole state in one write, which the server records as an undo
 * entry, so a landed write refetches the undo log. The cache takes the response only once
 * the write lands, so a failure leaves the sheet showing what the server still holds and a
 * view renders the mutation's own `error`.
 *
 * Writes queue in one scope with the definition's and an undo, so an edit lands on the
 * result of every write started before it. An edit that returns the state it was given
 * writes nothing.
 *
 * `writing` is true while any of the character's state writes or an undo is in flight, from
 * this view or another. A whole state carries what its caller read, so a control writing
 * one waits on it: started meanwhile, it would overwrite the first write with what the
 * first replaced.
 */
export function useReplaceCharacterState(id: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation<CharacterStateRecord, Error, StateWrite>({
    mutationKey: characterStateWriteKey(id),
    scope: { id: characterWriteScope(id) },
    mutationFn: async (write) => {
      if (typeof write !== "function") {
        return apiMutate("PUT", `/characters/${id}/state`, characterStateRecordSchema, write);
      }
      const record = queryClient.getQueryData<CharacterStateRecord>(characterStateKey(id));
      if (!record) throw new Error("The character has not loaded yet.");
      const after = write(record.state);
      if (after === record.state) return record;
      return apiMutate("PUT", `/characters/${id}/state`, characterStateRecordSchema, after);
    },
    onSuccess: (record) => {
      queryClient.setQueryData(characterStateKey(id), record);
      queryClient.invalidateQueries({ queryKey: characterUndoKey(id) });
      queryClient.invalidateQueries({ queryKey: characterDerivedKey(id) });
    },
  });
  const writing =
    useIsMutating({ mutationKey: characterStateWriteKey(id) }) +
      useIsMutating({ mutationKey: characterUndoWriteKey(id) }) >
    0;
  return { ...mutation, writing };
}
