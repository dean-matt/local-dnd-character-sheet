import { homebrewBackgroundInputSchema } from "@dnd/catalog";
import { equipmentProblem } from "./backgroundEquipmentShapes.ts";
import {
  BACKGROUND_GRANT_SPECS,
  type BackgroundGrantKey,
  grantProblem,
} from "./featGrantShapes.ts";

/**
 * `homebrewBackgroundInputSchema` with the checks the form adds before a save: a pick that
 * offers something to pick, coins that are not owed. The server takes a background as
 * written, so these hold only what the form shows; a shape it leaves to the JSON goes
 * unchecked.
 */
export const homebrewBackgroundFormSchema = homebrewBackgroundInputSchema.superRefine(
  (background, context) => {
    for (const key of Object.keys(BACKGROUND_GRANT_SPECS) as BackgroundGrantKey[]) {
      const message = grantProblem(background[key], BACKGROUND_GRANT_SPECS[key]);
      if (message) context.addIssue({ code: "custom", path: [key], message });
    }
    const message = equipmentProblem(background.startingEquipment);
    if (message) context.addIssue({ code: "custom", path: ["startingEquipment"], message });
  },
);
