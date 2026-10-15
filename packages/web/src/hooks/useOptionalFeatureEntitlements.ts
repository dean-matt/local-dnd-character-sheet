import { optionalFeatureEntitlementsSchema } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";
import { characterKey } from "./characterKeys.ts";

/**
 * What entitles a character to optional features, keyed under the character so a
 * definition write — a level, a feat or an option that grants more — refetches it.
 */
export function useOptionalFeatureEntitlements(id: string) {
  return useQuery({
    queryKey: [...characterKey(id), "optional-feature-entitlements"],
    queryFn: () =>
      apiGet(`/characters/${id}/optional-feature-entitlements`, optionalFeatureEntitlementsSchema),
    enabled: id.length > 0,
    retry: retryUnlessClientError,
  });
}
