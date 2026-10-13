import { characterRecordSchema } from "@dnd/character";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { characterKey } from "./characterKeys.ts";

export const characterQuery = (id: string) =>
  queryOptions({
    queryKey: characterKey(id),
    queryFn: () => apiGet(`/characters/${id}`, characterRecordSchema),
  });

export function useCharacter(id: string) {
  return useQuery({ ...characterQuery(id), enabled: id.length > 0 });
}
