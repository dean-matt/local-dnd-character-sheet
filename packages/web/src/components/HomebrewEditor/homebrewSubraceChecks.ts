import { homebrewRaceInputSchema, homebrewSubraceInputSchema } from "@dnd/catalog";

/**
 * `homebrewSubraceInputSchema` with the edition the editor sends beside the entry; the
 * server replaces it with its parent race's.
 */
export const homebrewSubraceFormSchema = homebrewSubraceInputSchema.extend({
  edition: homebrewRaceInputSchema.shape.edition,
});
