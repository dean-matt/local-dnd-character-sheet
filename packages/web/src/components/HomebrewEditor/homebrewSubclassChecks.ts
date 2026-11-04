import {
  homebrewClassFeaturesInputSchema,
  homebrewClassInputSchema,
  homebrewSubclassInputSchema,
} from "@dnd/catalog";

/**
 * `homebrewSubclassInputSchema` with the edition the editor sends beside the entry, which the
 * server replaces with its parent class's. `features` is not a field of the subclass row: a save
 * sends it to its own route.
 */
export const homebrewSubclassFormSchema = homebrewSubclassInputSchema.extend({
  edition: homebrewClassInputSchema.shape.edition,
  features: homebrewClassFeaturesInputSchema.optional(),
});
