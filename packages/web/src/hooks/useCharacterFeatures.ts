import { type CharacterFeatures, characterFeaturesSchema } from "@dnd/catalog";
import type { CharacterDerived } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";
import { characterKey } from "./characterKeys.ts";

/**
 * Each feature's limited uses as `derived` counts them from the character, where it counts
 * any: a feature matches only in its own group, so a feat never lends its uses to a racial
 * trait of the same name, and a class or subclass feature only at the level it arrives at.
 */
function withLimitedUses(
  features: CharacterFeatures,
  derived: Pick<CharacterDerived, "limitedUses"> | undefined,
): CharacterFeatures {
  if (!derived?.limitedUses.length) return features;
  return {
    groups: features.groups.map((group) => ({
      ...group,
      features: group.features.map((feature) => {
        if (!feature.resolved) return feature;
        const counted = derived.limitedUses.filter(
          (uses) =>
            uses.origin === group.origin &&
            uses.feature.name === feature.name &&
            uses.feature.source === feature.source &&
            (uses.level === null || uses.level === feature.level),
        );
        const [main, ...others] = counted.map(({ key, count, reset, restoredBy, part }) => ({
          key,
          count,
          reset,
          ...(restoredBy && { restoredBy }),
          ...(part && { part }),
        }));
        if (!main) return feature;
        return { ...feature, uses: main, ...(others.length > 0 && { otherUses: others }) };
      }),
    })),
  };
}

/**
 * A character's features, keyed under the character so a definition write refetches them,
 * with the uses `derived` counts folded in.
 */
export function useCharacterFeatures(id: string, derived: CharacterDerived | undefined) {
  return useQuery({
    queryKey: [...characterKey(id), "features"],
    queryFn: () => apiGet(`/characters/${id}/features`, characterFeaturesSchema),
    select: (features) => withLimitedUses(features, derived),
    enabled: id.length > 0,
    retry: retryUnlessClientError,
  });
}
