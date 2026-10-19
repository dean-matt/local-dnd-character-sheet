import { characterInventorySchema } from "@dnd/catalog";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";
import { shownName } from "../lib/shownName.ts";
import { characterInventoryKey } from "./characterKeys.ts";

/**
 * A character's items, keyed under the character so a definition write refetches them, each
 * named as the sheet shows it: a magic variant held alone keeps its template's starred name.
 */
export function useCharacterInventory(id: string) {
  return useQuery({
    queryKey: characterInventoryKey(id),
    queryFn: () => apiGet(`/characters/${id}/inventory`, characterInventorySchema),
    select: ({ items }) => ({
      items: items.map((item) => ({ ...item, name: shownName(item.name) })),
    }),
    enabled: id.length > 0,
    retry: retryUnlessClientError,
  });
}
