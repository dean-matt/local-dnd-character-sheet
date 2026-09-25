import { type CharacterPageRecord, characterPageRecordSchema } from "@dnd/character";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { z } from "zod";
import { apiGet, apiMutate } from "../lib/api.ts";
import { characterKey } from "./useCharacters.ts";

const pagesSchema = z.array(characterPageRecordSchema);
const pagesKey = (id: string) => [...characterKey(id), "pages"] as const;

/** A character's pages in display order, hidden ones included, so a URL still reaches one. */
export function useCharacterPages(id: string) {
  return useQuery({
    queryKey: pagesKey(id),
    queryFn: () => apiGet(`/characters/${id}/pages`, pagesSchema),
    enabled: id.length > 0,
  });
}

/**
 * `write` replaces the whole list, in display order. The cache takes the new list before
 * `write` returns — `onMutate` would run a tick later, and a second press inside that
 * tick would build on the list before the first — and the requests go out one at a time
 * in press order, since two in flight at once could land out of order and keep the older
 * list. A response lands in the cache only when no later write is waiting, since it would
 * otherwise undo that write's list; a failure refetches what the server holds.
 */
export function useReplaceCharacterPages(id: string) {
  const queryClient = useQueryClient();
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mutationKey = [...pagesKey(id), "write"];

  const mutation = useMutation<CharacterPageRecord[], Error, CharacterPageRecord[]>({
    mutationKey,
    mutationFn: (pages) => {
      const write = queue.current.then(() =>
        apiMutate(
          "PUT",
          `/characters/${id}/pages`,
          pagesSchema,
          pages.map(({ preset: _preset, ...page }) => page),
        ),
      );
      queue.current = write.catch(() => undefined);
      return write;
    },
    onSuccess: (pages) => {
      if (queryClient.isMutating({ mutationKey }) === 1) {
        queryClient.setQueryData(pagesKey(id), pages);
      }
    },
    onError: () => queryClient.invalidateQueries({ queryKey: pagesKey(id) }),
  });

  function write(pages: CharacterPageRecord[]) {
    // Cancelling reverts an in-flight read synchronously, so its answer cannot land over
    // the list set on the next line.
    void queryClient.cancelQueries({ queryKey: pagesKey(id) });
    queryClient.setQueryData(pagesKey(id), pages);
    mutation.mutate(pages);
  }

  const current = () => queryClient.getQueryData<CharacterPageRecord[]>(pagesKey(id)) ?? [];

  return { ...mutation, write, current };
}

export function useRestoreDefaultPages(id: string) {
  const queryClient = useQueryClient();

  return useMutation<CharacterPageRecord[], Error, void>({
    mutationFn: () =>
      apiMutate("POST", `/characters/${id}/pages/restore-defaults`, pagesSchema, {}),
    onSuccess: (pages) => queryClient.setQueryData(pagesKey(id), pages),
  });
}
