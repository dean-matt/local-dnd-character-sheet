import { characterInventorySchema } from "@dnd/catalog";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";
import { characterInventoryKey } from "./characterKeys.ts";

/** A character's items, keyed under the character so a definition write refetches them. */
export function useCharacterInventory(id: string) {
  return useQuery({
    queryKey: characterInventoryKey(id),
    queryFn: () => apiGet(`/characters/${id}/inventory`, characterInventorySchema),
    enabled: id.length > 0,
    retry: retryUnlessClientError,
  });
}
