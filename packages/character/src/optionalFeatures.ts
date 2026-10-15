import { z } from "zod";
import { type CharacterDefinition, optionalFeatureGrantorSchema } from "./definition.ts";
import { entryKey, refKey } from "./keys.ts";
import { editionSchema } from "./refs.ts";

/**
 * One grantor's count of one option type: a class or subclass at the level the character
 * holds it, or a feat or option held at any level. `known` is that grantor's running total,
 * and `edition` the ruleset whose options it offers — its own row's.
 */
const optionalFeatureEntitlementSchema = z.strictObject({
  featureType: z.string().min(1),
  known: z.int().min(1),
  grantedBy: optionalFeatureGrantorSchema,
  edition: editionSchema,
});

export type OptionalFeatureEntitlement = z.infer<typeof optionalFeatureEntitlementSchema>;

export const optionalFeatureEntitlementsSchema = z.strictObject({
  entitlements: z.array(optionalFeatureEntitlementSchema),
});

type Grantor = OptionalFeatureEntitlement["grantedBy"];
type Pick = CharacterDefinition["optionalFeatures"][number];

/** A grantor flattened for comparison: a subclass is keyed with its class. */
export const grantorKey = (grantor: Grantor): string =>
  grantor.kind === "subclass"
    ? `subclass|${refKey(grantor.ref)}|${entryKey(grantor.class)}`
    : `${grantor.kind}|${entryKey(grantor.ref)}`;

/** One option type: what entitles the character to it, the total, and the picks made. */
export type OptionalFeatureTally = {
  featureType: string;
  entitlements: OptionalFeatureEntitlement[];
  known: number;
  picks: Pick[];
};

/**
 * Every option type the character is entitled to or holds a pick of, entitled types
 * first. A pick of a type nothing entitles any longer is a tally with `known` 0, so the
 * sheet reports it rather than dropping it.
 */
export function optionalFeatureTallies(
  picks: readonly Pick[],
  entitlements: readonly OptionalFeatureEntitlement[],
): OptionalFeatureTally[] {
  const types = [...new Set([...entitlements, ...picks].map((each) => each.featureType))];
  return types.map((featureType) => {
    const granted = entitlements.filter((each) => each.featureType === featureType);
    return {
      featureType,
      entitlements: granted,
      known: granted.reduce((sum, each) => sum + each.known, 0),
      picks: picks.filter((pick) => pick.featureType === featureType),
    };
  });
}

/**
 * The entitlement a new pick of the tally's type spends: the first with picks to spare, or
 * the first of all where every one is spent, so a pick past the total still names a grantor.
 */
export function spareEntitlement(
  tally: OptionalFeatureTally,
): OptionalFeatureEntitlement | undefined {
  return (
    tally.entitlements.find(
      (each) =>
        tally.picks.filter((pick) => grantorKey(pick.grantedBy) === grantorKey(each.grantedBy))
          .length < each.known,
    ) ?? tally.entitlements[0]
  );
}
