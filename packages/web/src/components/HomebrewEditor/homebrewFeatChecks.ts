import { homebrewFeatInputSchema } from "@dnd/catalog";
import { FEAT_GRANT_SPECS, type FeatGrantKey, grantProblem } from "./featGrantShapes.ts";
import { prerequisiteProblem } from "./featPrerequisiteShapes.ts";

/**
 * `homebrewFeatInputSchema` with the checks the form adds before a save: a pick that offers
 * something to pick, a level and score minimums the sheet can meet. The server takes a feat
 * as written, since the sheet reads a malformed field as absent, so these hold only what the
 * form shows; a shape it leaves to the JSON goes unchecked.
 */
export const homebrewFeatFormSchema = homebrewFeatInputSchema.superRefine((feat, context) => {
  for (const key of Object.keys(FEAT_GRANT_SPECS) as FeatGrantKey[]) {
    const message = grantProblem(feat[key], FEAT_GRANT_SPECS[key]);
    if (message) context.addIssue({ code: "custom", path: [key], message });
  }
  const { prerequisite } = feat;
  if (!Array.isArray(prerequisite)) return;
  prerequisite.forEach((alternative, at) => {
    const message = prerequisiteProblem(alternative, at + 1);
    if (message) context.addIssue({ code: "custom", path: ["prerequisite"], message });
  });
});
