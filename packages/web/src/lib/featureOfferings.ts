import type { ClassGrants } from "@dnd/catalog";
import type { ContentRef, FeatureKey } from "@dnd/character";

/** A feature that offers a choice of the features beside it, and every option it offers. */
export type FeatureOffering = { feature: FeatureKey; options: ContentRef[] };

type Owner = Omit<FeatureKey, "name" | "source" | "level">;

/**
 * Each of `features` that offers a choice, keyed under `owner`, the class or subclass that
 * grants them, with the options that name it at its own level.
 */
export function featureOfferings(
  features: readonly ClassGrants["features"][number][],
  owner: Owner,
): FeatureOffering[] {
  return features
    .filter((offer) => offer.choose !== undefined)
    .map((offer) => ({
      feature: { ...owner, name: offer.name, source: offer.source, level: offer.level },
      options: features
        .filter(({ level, offeredBy }) => level === offer.level && offeredBy?.name === offer.name)
        .filter(({ offeredBy }) => offeredBy?.source === offer.source)
        .map(({ name, source }) => ({ name, source })),
    }));
}
