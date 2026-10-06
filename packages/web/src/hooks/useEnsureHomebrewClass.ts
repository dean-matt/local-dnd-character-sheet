import { type HomebrewClassInput, homebrewClassRecordSchema } from "@dnd/catalog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet, apiMutate } from "../lib/api.ts";
import { homebrewClassKey } from "./useHomebrewClass.ts";

/**
 * The homebrew class of `input`'s name and edition: the one already stored, else a new
 * one. Reusing it keeps a name typed twice from failing on the name a homebrew class
 * holds alone; a stored class keeps its own hit die.
 */
export function useEnsureHomebrewClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: HomebrewClassInput) => {
      const stored = await apiGet("/homebrew/classes", z.array(homebrewClassRecordSchema));
      const same = stored.find(
        (row) =>
          row.edition === input.edition && row.name.toLowerCase() === input.name.toLowerCase(),
      );
      return (
        same ?? (await apiMutate("POST", "/homebrew/classes", homebrewClassRecordSchema, input))
      );
    },
    onSuccess: (record) => queryClient.setQueryData(homebrewClassKey(record.id), record),
  });
}
