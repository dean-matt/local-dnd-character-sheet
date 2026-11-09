import { rollLogEntrySchema, type rollRecordSchema } from "@dnd/character";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { apiMutate } from "../lib/api.ts";
import { rollsKey } from "./characterKeys.ts";

/** Records a roll the browser made in the character's roll log. */
export function useRecordRoll(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (roll: z.infer<typeof rollRecordSchema>) =>
      apiMutate("POST", `/characters/${id}/rolls`, rollLogEntrySchema, roll),
    onSuccess: () => client.invalidateQueries({ queryKey: rollsKey }),
  });
}
