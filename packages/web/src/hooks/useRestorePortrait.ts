import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "../lib/api.ts";
import { characterKey, charactersKey } from "./characterKeys.ts";

/** Swaps the character's portrait with the one an upload or removal displaced. */
export function useRestorePortrait(id: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: () => apiPost(`/characters/${id}/portrait/restore`),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: characterKey(id), exact: true }),
        queryClient.invalidateQueries({ queryKey: charactersKey, exact: true }),
      ]),
  });
}
