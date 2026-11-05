import { characterStateRecordSchema } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";
import { characterStateKey } from "./characterKeys.ts";

/** A character's play state — hit points, hit dice, conditions — keyed under the character. */
export function useCharacterState(id: string) {
  return useQuery({
    queryKey: characterStateKey(id),
    queryFn: () => apiGet(`/characters/${id}/state`, characterStateRecordSchema),
    enabled: id.length > 0,
    retry: retryUnlessClientError,
  });
}
