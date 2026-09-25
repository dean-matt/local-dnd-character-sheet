import { characterInventorySchema } from "@dnd/catalog";
import { useQuery } from "@tanstack/react-query";
import { apiGet, retryUnlessClientError } from "../lib/api.ts";
import { characterKey } from "./useCharacters.ts";

/** A character's items, keyed under the character so a definition write refetches them. */
export function useCharacterInventory(id: string) {
  return useQuery({
    queryKey: [...characterKey(id), "inventory"],
    queryFn: () => apiGet(`/characters/${id}/inventory`, characterInventorySchema),
    enabled: id.length > 0,
    retry: retryUnlessClientError,
  });
}
