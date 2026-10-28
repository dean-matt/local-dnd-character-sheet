/**
 * The worked example a new domain's hook copies: a list, a read and a write against
 * `/characters`, each in its own file and parsed with the schema `@dnd/character` already
 * exports.
 */
import { characterRecordSchema } from "@dnd/character";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet } from "../lib/api.ts";
import { charactersKey } from "./characterKeys.ts";

/** Every character, for a reader that narrows the list with its own `select`. */
export const charactersQuery = queryOptions({
  queryKey: charactersKey,
  queryFn: () => apiGet("/characters", z.array(characterRecordSchema)),
});

export function useCharacters() {
  return useQuery(charactersQuery);
}
