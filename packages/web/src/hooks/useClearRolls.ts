import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiDelete } from "../lib/api.ts";
import { rollsKey } from "./characterKeys.ts";

/** Deletes every character's rolls from the roll log. */
export function useClearRolls() {
  const client = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => apiDelete("/rolls"),
    onSuccess: () => client.invalidateQueries({ queryKey: rollsKey }),
  });
}
