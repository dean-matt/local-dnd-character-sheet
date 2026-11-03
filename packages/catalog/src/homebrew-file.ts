import { z } from "zod";
import { homebrewClassFeaturesSchema, homebrewClassResourcesSchema } from "./class.ts";
import { homebrewCollectionSchema } from "./homebrew-history.ts";

const homebrewRefSchema = z.strictObject({ collection: homebrewCollectionSchema, id: z.string() });

/** The homebrew rows to export, by kind and id. */
export const homebrewExportRequestSchema = z.strictObject({
  entries: z.array(homebrewRefSchema).min(1),
});

export type HomebrewExportRequest = z.infer<typeof homebrewExportRequestSchema>;

/**
 * One homebrew row as its kind's save would write it again, under the id it had here: a
 * subclass or subrace names a homebrew parent by that id. A class carries its features and
 * resource tables beside it. `input` is checked by the kind's own schema on the way back in.
 */
const homebrewFileEntrySchema = homebrewRefSchema.extend({
  input: z.looseObject({ name: z.string() }),
  features: homebrewClassFeaturesSchema.optional(),
  resources: homebrewClassResourcesSchema.optional(),
});

/** A file of homebrew rows, a parent always ahead of the subclasses and subraces under it. */
export const homebrewFileSchema = z.strictObject({
  format: z.literal("local-dnd-character-sheet/homebrew"),
  version: z.literal(1),
  entries: z.array(homebrewFileEntrySchema),
});

export type HomebrewFile = z.infer<typeof homebrewFileSchema>;
