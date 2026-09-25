import { characterFeaturesSchema } from "@dnd/catalog";
import { useQuery } from "@tanstack/react-query";
import { apiGet, retryUnlessClientError } from "../lib/api.ts";
import { characterKey } from "./useCharacters.ts";

/** A character's features, keyed under the character so a definition write refetches them. */
export function useCharacterFeatures(id: string) {
  return useQuery({
    queryKey: [...characterKey(id), "features"],
    queryFn: () => apiGet(`/characters/${id}/features`, characterFeaturesSchema),
    enabled: id.length > 0,
    retry: retryUnlessClientError,
  });
}
