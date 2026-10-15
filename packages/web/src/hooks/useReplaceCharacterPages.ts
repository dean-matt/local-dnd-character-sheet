import type { CharacterPageRecord } from "@dnd/character";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { apiMutate } from "../lib/api.ts";
import {
  pageHistoryDepth,
  rememberPages,
  subscribePageHistory,
  takeLastPages,
} from "../lib/pageHistory.ts";
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
 *
 * Each `write` records the list it replaces in `lib/pageHistory.ts`, and `undo` writes the
 * newest one back. `key` names the edit, so a run of saves to one field undoes as one.
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

  function put(pages: CharacterPageRecord[]): Promise<CharacterPageRecord[]> {
    // Cancelling reverts an in-flight read synchronously, so its answer cannot land over
    // the list set on the next line.
    void queryClient.cancelQueries({ queryKey: characterPagesKey(id) });
    queryClient.setQueryData(characterPagesKey(id), pages);
    return mutation.mutateAsync(pages);
  }

  const current = () =>
    queryClient.getQueryData<CharacterPageRecord[]>(characterPagesKey(id)) ?? [];

  /** `write` for a caller that reports its own failure, such as a `Field`: it rejects on one. */
  async function save(pages: CharacterPageRecord[], key?: string): Promise<void> {
    rememberPages(queryClient, id, current(), key);
    await put(pages);
  }

  // A failure already shows through `error`, so a caller that does not await drops it.
  function write(pages: CharacterPageRecord[], key?: string) {
    save(pages, key).catch(() => undefined);
  }

  /** Writes back the list the newest change replaced; answers false with nothing to undo. */
  function undo(): boolean {
    const before = takeLastPages(queryClient, id);
    if (before) put(before).catch(() => undefined);
    return before !== undefined;
  }

  const canUndo = useSyncExternalStore(
    useCallback((listener) => subscribePageHistory(queryClient, listener), [queryClient]),
    () => pageHistoryDepth(queryClient, id) > 0,
  );

  return { ...mutation, write, save, current, undo, canUndo };
}
