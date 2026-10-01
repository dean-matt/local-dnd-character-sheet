import { type CharacterPageRecord, characterPageRecordSchema } from "@dnd/character";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiMutate } from "../lib/api.ts";
import { characterPagesKey } from "./characterKeys.ts";

export function useRestoreDefaultPages(id: string) {
  const queryClient = useQueryClient();

  return useMutation<CharacterPageRecord[], Error, void>({
    mutationFn: () =>
      apiMutate(
        "POST",
        `/characters/${id}/pages/restore-defaults`,
        z.array(characterPageRecordSchema),
        {},
      ),
    onSuccess: (pages) => queryClient.setQueryData(characterPagesKey(id), pages),
  });
}
