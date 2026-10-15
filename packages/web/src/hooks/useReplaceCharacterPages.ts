import type { CharacterPageRecord } from "@dnd/character";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { apiMutate } from "../lib/api.ts";
import {
  forgetPages,
  pageHistoryDepth,
  rememberPages,
  subscribePageHistory,
  takeLastPages,
} from "../lib/pageHistory.ts";
import { queuePageWrite } from "../lib/pageWriteQueue.ts";
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
  const mutationKey = [...characterPagesKey(id), "write"];

  const mutation = useMutation<CharacterPageRecord[], Error, CharacterPageRecord[]>({
    mutationKey,
    mutationFn: (pages) =>
      queuePageWrite(queryClient, id, () =>
        apiMutate(
          "PUT",
          `/characters/${id}/pages`,
          characterPagesSchema,
          pages.map(({ preset: _preset, ...page }) => page),
        ),
      ),
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

  /**
   * `write` for a caller that reports its own failure, such as a `Field`: it rejects on one.
   * A failed write drops the entry it opened, which would undo to what the server still holds.
   */
  async function save(pages: CharacterPageRecord[], key?: string): Promise<void> {
    const entry = rememberPages(queryClient, id, current(), key);
    try {
      await put(pages);
    } catch (error) {
      if (entry) forgetPages(queryClient, id, entry);
      throw error;
    }
  }

  // A failure already shows through `error`, so a caller that does not await drops it.
  function write(pages: CharacterPageRecord[], key?: string) {
    save(pages, key).catch(() => undefined);
  }

  /**
   * Writes back the list the newest change replaced, and returns it; `undefined` with
   * nothing to undo. A write that fails puts the entry back, so the next press retries it.
   */
  function undo(): CharacterPageRecord[] | undefined {
    const before = takeLastPages(queryClient, id);
    if (before) put(before).catch(() => rememberPages(queryClient, id, before));
    return before;
  }

  const canUndo = useSyncExternalStore(
    useCallback((listener) => subscribePageHistory(queryClient, listener), [queryClient]),
    () => pageHistoryDepth(queryClient, id) > 0,
  );

  return { ...mutation, write, save, current, undo, canUndo };
}
