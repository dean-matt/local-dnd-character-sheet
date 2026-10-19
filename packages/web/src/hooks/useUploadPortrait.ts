import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUpload } from "../lib/api.ts";
import { characterKey, charactersKey } from "./characterKeys.ts";

/**
 * Stores `file` as the character's portrait. The record's `portraitUpdatedAt` moves, so the
 * character and the list refetch to pick the new image up.
 */
export function useUploadPortrait(id: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, File>({
    mutationFn: (file) => apiUpload(`/characters/${id}/portrait`, file),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: characterKey(id), exact: true }),
        queryClient.invalidateQueries({ queryKey: charactersKey, exact: true }),
      ]),
  });
}
