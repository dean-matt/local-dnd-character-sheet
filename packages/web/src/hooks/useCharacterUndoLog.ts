import { undoLogSchema } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";
import { characterUndoKey } from "./characterKeys.ts";

/** What each undo would restore, newest first. A definition write invalidates it by prefix. */
export function useCharacterUndoLog(id: string) {
  return useQuery({
    queryKey: characterUndoKey(id),
    queryFn: () => apiGet(`/characters/${id}/undo`, undoLogSchema),
    enabled: id.length > 0,
    retry: retryUnlessClientError,
  });
}
