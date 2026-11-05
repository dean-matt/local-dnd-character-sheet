import {
  type CharacterState,
  type CharacterStateRecord,
  characterStateRecordSchema,
} from "@dnd/character";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiMutate } from "../lib/api.ts";
import { characterStateKey } from "./characterKeys.ts";

/**
 * Replaces a character's whole state in one write. The cache takes the response only once
 * the write lands, so a failure leaves the sheet showing what the server still holds and a
 * view renders the mutation's own `error`.
 */
export function useReplaceCharacterState(id: string) {
  const queryClient = useQueryClient();
  return useMutation<CharacterStateRecord, Error, CharacterState>({
    mutationFn: (state) =>
      apiMutate("PUT", `/characters/${id}/state`, characterStateRecordSchema, state),
    onSuccess: (record) => queryClient.setQueryData(characterStateKey(id), record),
  });
}
