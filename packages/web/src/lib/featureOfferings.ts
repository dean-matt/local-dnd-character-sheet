import type { ClassGrants, SheetFeature } from "@dnd/catalog";
import { type ContentRef, type FeatureKey, featurePickOffers } from "@dnd/character";

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

/** A feature that asks the player for a proficiency, a language or a tool, and what it asks. */
export type FeaturePicking = {
  feature: FeatureKey;
  offers: NonNullable<SheetFeature["picks"]>["offers"];
};

/** Each of `features` that records picks, keyed under `owner`, the class or subclass that grants them. */
export function featurePickings(
  features: readonly ClassGrants["features"][number][],
  owner: Owner,
): FeaturePicking[] {
  return features.flatMap(({ name, source, level }) => {
    const feature = { ...owner, name, source, level };
    const offers = featurePickOffers(feature);
    return offers.length > 0 ? [{ feature, offers }] : [];
  });
}
