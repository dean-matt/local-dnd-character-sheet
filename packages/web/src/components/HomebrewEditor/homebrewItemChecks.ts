import { homebrewItemInputSchema } from "@dnd/catalog";
import { isRollable } from "@dnd/dice";

const DICE = ["dmg1", "dmg2"] as const;

/**
 * `homebrewItemInputSchema` with the checks the form adds before a save: damage the dice
 * roller can roll or a flat number, and a critical range the sheet reads. The server takes either as written,
 * since `catalog` holds no dice parser, and the sheet shows an unrollable die as text and
 * ignores a critical range outside 2 to 19.
 */
export const homebrewItemFormSchema = homebrewItemInputSchema.superRefine((item, context) => {
  for (const key of DICE) {
    const dice = item[key];
    // A flat number is damage too, as a blowgun's `"1"`, which the roller takes no dice for.
    if (
      dice !== undefined &&
      (typeof dice !== "string" || !(/^\d+$/.test(dice) || isRollable(dice)))
    ) {
      context.addIssue({
        code: "custom",
        path: [key],
        message: "Not dice notation, such as 1d8 or 2d6",
      });
    }
  }
  const crit = item.critThreshold;
  if (crit !== undefined && !(Number.isInteger(crit) && Number(crit) >= 2 && Number(crit) <= 19)) {
    context.addIssue({
      code: "custom",
      path: ["critThreshold"],
      message: "A d20 roll from 2 to 19",
    });
  }
});
