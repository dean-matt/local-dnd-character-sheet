import { homebrewRaceInputSchema } from "@dnd/catalog";
import { z } from "zod";
import { grantProblem, RACE_GRANT_SPECS, type RaceGrantKey } from "./featGrantShapes.ts";
import { raceAbilityProblem } from "./raceAbilityShapes.ts";
import { RACE_SIZE_CODES } from "./raceSizes.ts";

const stated = homebrewRaceInputSchema.shape.speed;

/** A field checked by itself, so its problem shows even while another field has one. */
const checked = (problem: (value: unknown) => string | undefined) =>
  z
    .unknown()
    .superRefine((value, context) => {
      const message = problem(value);
      if (message) context.addIssue({ code: "custom", message });
    })
    .optional();

const grants = Object.fromEntries(
  (Object.keys(RACE_GRANT_SPECS) as RaceGrantKey[]).map((key) => [
    key,
    checked((value) => grantProblem(value, RACE_GRANT_SPECS[key])),
  ]),
);

/**
 * `homebrewRaceInputSchema` with the checks the form adds before a save: a size and a walking
 * speed with a message that names what to do, and the picks and amounts the form shows. The
 * server takes a race as written, so the grants hold only what the form shows; a shape it
 * leaves to the JSON goes unchecked.
 */
export const homebrewRaceFormSchema = homebrewRaceInputSchema.extend({
  size: z.array(z.enum(RACE_SIZE_CODES)).min(1, "Pick at least one size"),
  speed: z.custom<z.infer<typeof stated>>(
    (value) => stated.safeParse(value).success,
    "Walking speed: a whole number of feet, 0 or more",
  ),
  ability: checked(raceAbilityProblem),
  ...grants,
});
