import { z } from "zod";
import { mechanicListSchema } from "./featureMechanics.ts";
import { contentRefSchema } from "./refs.ts";

/** The mechanics a table rules a catalog feature has, in place of the ones recorded for it. */
export const homebrewFeatureEffectInputSchema = contentRefSchema.extend({
  mechanics: mechanicListSchema,
});

export const homebrewFeatureEffectRecordSchema = homebrewFeatureEffectInputSchema.extend({
  id: z.string(),
  createdAt: z.iso.datetime(),
});

export type HomebrewFeatureEffectInput = z.infer<typeof homebrewFeatureEffectInputSchema>;
export type HomebrewFeatureEffectRecord = z.infer<typeof homebrewFeatureEffectRecordSchema>;
