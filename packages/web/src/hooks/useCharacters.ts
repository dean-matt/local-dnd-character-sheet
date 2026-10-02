/**
 * The worked example the next domain's hook copies: a list, a read and a write against
 * `/characters`, each in its own file and parsed with the schema `@dnd/character` already
 * exports.
 */
import { characterRecordSchema } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet } from "../lib/api.ts";
import { charactersKey } from "./characterKeys.ts";

export function useCharacters() {
  return useQuery({
    queryKey: charactersKey,
    queryFn: () => apiGet("/characters", z.array(characterRecordSchema)),
  });
}
