import { homebrewClassInputSchema, homebrewSubclassInputSchema } from "@dnd/catalog";

/**
 * `homebrewSubclassInputSchema` with the edition the editor sends beside the entry; the
 * server replaces it with its parent class's.
 */
export const homebrewSubclassFormSchema = homebrewSubclassInputSchema.extend({
  edition: homebrewClassInputSchema.shape.edition,
});
