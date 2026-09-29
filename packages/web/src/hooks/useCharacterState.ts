import { characterStateRecordSchema } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { apiGet, retryUnlessClientError } from "../lib/api.ts";
import { characterKey } from "./useCharacters.ts";

/** A character's play state — hit points, hit dice, conditions — keyed under the character. */
export function useCharacterState(id: string) {
  return useQuery({
    queryKey: [...characterKey(id), "state"],
    queryFn: () => apiGet(`/characters/${id}/state`, characterStateRecordSchema),
    enabled: id.length > 0,
    retry: retryUnlessClientError,
  });
}
