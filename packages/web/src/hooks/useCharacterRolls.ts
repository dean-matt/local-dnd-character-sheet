import { rollLogEntrySchema } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";
import { characterRollsKey } from "./characterKeys.ts";

/** The character's recent rolls, newest first, at most 200. Recording a roll invalidates it. */
export function useCharacterRolls(id: string) {
  return useQuery({
    queryKey: characterRollsKey(id),
    queryFn: () => apiGet(`/characters/${id}/rolls`, z.array(rollLogEntrySchema)),
    enabled: id.length > 0,
    retry: retryUnlessClientError,
  });
}
