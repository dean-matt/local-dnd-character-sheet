/**
 * The worked example the next domain's hook copies: a list, a read and a write against
 * `/characters`, each parsed with the schema `@dnd/character` already exports. The write
 * path is exercised here and by its tests; no view calls the mutation yet, since turning
 * editing on in any view is a later milestone.
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
 * Replaces a character's definition. On success the mutation writes the detail and list
 * caches from the response rather than merely invalidating them, so a reader sees the
 * write without a second round trip. On failure the caches stay untouched and the
 * mutation's own `error` is what a view renders — TanStack Query never resolves a
 * failed write as data.
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
