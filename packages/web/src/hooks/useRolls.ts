import { rollLogEntrySchema } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";
import { rollsKey } from "./characterKeys.ts";

/** Every character's recent rolls, newest first. Recording a roll invalidates it. */
export function useRolls() {
  return useQuery({
    queryKey: rollsKey,
    queryFn: () => apiGet("/rolls", z.array(rollLogEntrySchema)),
    retry: retryUnlessClientError,
  });
}
