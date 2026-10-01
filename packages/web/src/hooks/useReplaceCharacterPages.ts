import type { CharacterPageRecord } from "@dnd/character";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { apiMutate } from "../lib/api.ts";
import { characterPagesKey } from "./characterKeys.ts";
import { characterPagesSchema } from "./characterPagesSchema.ts";

/**
 * `write` replaces the whole list, in display order. The cache takes the new list before
 * `write` returns — `onMutate` would run a tick later, and a second press inside that
 * tick would build on the list before the first — and the requests go out one at a time
 * in press order, since two in flight at once could land out of order and keep the older
 * list. A response lands in the cache only when no later write is waiting, since it would
 * otherwise undo that write's list. A failure refetches what the server holds, which can
 * show an older list until a write still queued behind it replies — a flicker, not a loss.
 */
export function useReplaceCharacterPages(id: string) {
  const queryClient = useQueryClient();
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mutationKey = [...characterPagesKey(id), "write"];

  const mutation = useMutation<CharacterPageRecord[], Error, CharacterPageRecord[]>({
    mutationKey,
    mutationFn: (pages) => {
      const write = queue.current.then(() =>
        apiMutate(
          "PUT",
          `/characters/${id}/pages`,
          characterPagesSchema,
          pages.map(({ preset: _preset, ...page }) => page),
        ),
      );
      queue.current = write.catch(() => undefined);
      return write;
    },
    onSuccess: (pages) => {
      if (queryClient.isMutating({ mutationKey }) === 1) {
        queryClient.setQueryData(characterPagesKey(id), pages);
      }
    },
    onError: () => queryClient.invalidateQueries({ queryKey: characterPagesKey(id) }),
  });

  function write(pages: CharacterPageRecord[]) {
    // Cancelling reverts an in-flight read synchronously, so its answer cannot land over
    // the list set on the next line.
    void queryClient.cancelQueries({ queryKey: characterPagesKey(id) });
    queryClient.setQueryData(characterPagesKey(id), pages);
    mutation.mutate(pages);
  }

  const current = () =>
    queryClient.getQueryData<CharacterPageRecord[]>(characterPagesKey(id)) ?? [];

  return { ...mutation, write, current };
}
