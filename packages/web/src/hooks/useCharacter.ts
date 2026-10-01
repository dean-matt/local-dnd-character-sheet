import { characterRecordSchema } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { characterKey } from "./characterKeys.ts";

export function useCharacter(id: string) {
  return useQuery({
    queryKey: characterKey(id),
    queryFn: () => apiGet(`/characters/${id}`, characterRecordSchema),
    enabled: id.length > 0,
  });
}
