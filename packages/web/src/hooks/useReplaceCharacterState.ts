import {
  type CharacterState,
  type CharacterStateRecord,
  characterStateRecordSchema,
} from "@dnd/character";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiMutate } from "../lib/api.ts";
import { characterStateKey, characterStateWriteKey } from "./characterKeys.ts";

/**
 * Replaces a character's whole state in one write. The cache takes the response only once
 * the write lands, so a failure leaves the sheet showing what the server still holds and a
 * view renders the mutation's own `error`.
 *
 * `writing` is true while any of the character's state writes is in flight, from this view or
 * another. Each write carries the whole state its caller read, so a control waits on it: a
 * second write started meanwhile would overwrite the first with what the first replaced.
 */
export function useReplaceCharacterState(id: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation<CharacterStateRecord, Error, CharacterState>({
    mutationKey: characterStateWriteKey(id),
    mutationFn: (state) =>
      apiMutate("PUT", `/characters/${id}/state`, characterStateRecordSchema, state),
    onSuccess: (record) => queryClient.setQueryData(characterStateKey(id), record),
  });
  const writing = useIsMutating({ mutationKey: characterStateWriteKey(id) }) > 0;
  return { ...mutation, writing };
}
