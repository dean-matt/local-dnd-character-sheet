import type { CharacterPageRecord } from "@dnd/character";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiMutate } from "../lib/api.ts";
import { characterPagesKey } from "./characterKeys.ts";
import { characterPagesSchema } from "./characterPagesSchema.ts";

export function useRestoreDefaultPages(id: string) {
  const queryClient = useQueryClient();

  return useMutation<CharacterPageRecord[], Error, void>({
    mutationFn: () =>
      apiMutate("POST", `/characters/${id}/pages/restore-defaults`, characterPagesSchema, {}),
    onSuccess: (pages) => queryClient.setQueryData(characterPagesKey(id), pages),
  });
}
