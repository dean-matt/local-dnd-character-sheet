/**
 * A homebrew optional feature's `json`, in the shape an `optional_features` row writes: the
 * pool half of the join `docs/optional-features.md` describes, a `featureType` list of the
 * codes that offer it, such as `EI`. A code the catalog has never used is as valid as one it
 * has. `prerequisite` stays upstream's raw list, read by `optionalFeaturePrerequisitesSchema`.
 */
import { EDITIONS } from "@dnd/rules";
import { z } from "zod";
import { entriesSchema } from "./entry.ts";

export const homebrewOptionalFeatureEntrySchema = z.looseObject({
  name: z.string().min(1),
  source: z.string().min(1),
  featureType: z
    .array(z.string().min(1))
    .min(1)
    .refine((types) => new Set(types).size === types.length, { error: "a feature type repeats" }),
  prerequisite: z.array(z.record(z.string(), z.unknown())).optional(),
  entries: entriesSchema.optional(),
});

export type HomebrewOptionalFeature = z.infer<typeof homebrewOptionalFeatureEntrySchema>;

/** What a caller submits to create or replace a homebrew optional feature; the server stamps `source`. */
export const homebrewOptionalFeatureInputSchema = homebrewOptionalFeatureEntrySchema
  .omit({ source: true })
  .extend({ edition: z.enum(EDITIONS) });

export type HomebrewOptionalFeatureInput = z.infer<typeof homebrewOptionalFeatureInputSchema>;

/** A stored homebrew optional feature, as an endpoint returns it. */
export const homebrewOptionalFeatureRecordSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  edition: z.enum(EDITIONS),
  json: homebrewOptionalFeatureEntrySchema,
  createdAt: z.iso.datetime(),
});

export type HomebrewOptionalFeatureRecord = z.infer<typeof homebrewOptionalFeatureRecordSchema>;
