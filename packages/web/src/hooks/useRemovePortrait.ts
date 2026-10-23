import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiDelete } from "../lib/api.ts";
import { characterKey, charactersKey } from "./characterKeys.ts";

export function useRemovePortrait(id: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: () => apiDelete(`/characters/${id}/portrait`),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: characterKey(id), exact: true }),
        queryClient.invalidateQueries({ queryKey: charactersKey, exact: true }),
      ]),
  });
}
