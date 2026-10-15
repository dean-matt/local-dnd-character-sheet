import type { CharacterPageRecord } from "@dnd/character";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiMutate } from "../lib/api.ts";
import { rememberPages } from "../lib/pageHistory.ts";
import { queuePageWrite } from "../lib/pageWriteQueue.ts";
import { characterPagesKey } from "./characterKeys.ts";
import { characterPagesSchema } from "./characterPagesSchema.ts";

/**
 * Waits behind any page write still in flight, so a save sent just before cannot land over
 * the restored list, and records the list it replaces once it lands, so an undo puts it back.
 */
export function useRestoreDefaultPages(id: string) {
  const queryClient = useQueryClient();

  return useMutation<CharacterPageRecord[], Error, void>({
    mutationFn: () =>
      queuePageWrite(queryClient, id, () =>
        apiMutate("POST", `/characters/${id}/pages/restore-defaults`, characterPagesSchema, {}),
      ),
    onSuccess: (pages) => {
      const before = queryClient.getQueryData<CharacterPageRecord[]>(characterPagesKey(id));
      if (before) rememberPages(queryClient, id, before);
      queryClient.setQueryData(characterPagesKey(id), pages);
    },
  });
}
