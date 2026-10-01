/**
 * The worked example the next domain's hook copies: a list, a read and a write against
 * `/characters`, each parsed with the schema `@dnd/character` already exports.
 */
import {
  type CharacterDefinition,
  type CharacterRecord,
  characterRecordSchema,
} from "@dnd/character";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet, apiMutate } from "../lib/api.ts";

export const charactersKey = ["characters"] as const;
export const characterKey = (id: string) => [...charactersKey, id] as const;

export function useCharacters() {
  return useQuery({
    queryKey: charactersKey,
    queryFn: () => apiGet("/characters", z.array(characterRecordSchema)),
  });
}

export function useCharacter(id: string) {
  return useQuery({
    queryKey: characterKey(id),
    queryFn: () => apiGet(`/characters/${id}`, characterRecordSchema),
    enabled: id.length > 0,
  });
}

/**
 * Replaces a character's definition. On success the mutation writes the response
 * straight into the detail cache and invalidates the list, so a reader sees the write
 * on the character's own page without waiting on a refetch. The invalidation is by
 * prefix, which also refetches the derived block and the inventory keyed under the
 * character; a grip written from a row reaches its damage chip that way. On failure both
 * caches stay untouched and a view renders the mutation's own `error` — TanStack Query
 * never resolves a failed write as data.
 */
export function useUpdateCharacterDefinition(id: string) {
  const queryClient = useQueryClient();

  return useMutation<CharacterRecord, Error, CharacterDefinition>({
    mutationFn: (definition) =>
      apiMutate("PUT", `/characters/${id}`, characterRecordSchema, definition),
    onSuccess: (record) => {
      queryClient.setQueryData(characterKey(id), record);
      queryClient.invalidateQueries({ queryKey: charactersKey });
    },
  });
}
