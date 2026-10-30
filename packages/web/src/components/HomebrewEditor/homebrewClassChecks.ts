import { casterProgressionSchema, homebrewClassInputSchema } from "@dnd/catalog";
import { z } from "zod";
import { CLASS_SKILL_SPEC, proficienciesIn, requirementProblem } from "./classShapes.ts";
import { grantProblem } from "./featGrantShapes.ts";

/** A field checked by itself, so its problem shows even while another field has one. */
const checked = (problem: (value: unknown) => string | undefined) =>
  z
    .unknown()
    .superRefine((value, context) => {
      const message = problem(value);
      if (message) context.addIssue({ code: "custom", message });
    })
    .optional();

/**
 * `homebrewClassInputSchema` with the checks the form adds before a save: the skills a class
 * offers and the minimum scores it asks, which the server takes as written, and the slot table.
 */
export const homebrewClassFormSchema = homebrewClassInputSchema.extend({
  startingProficiencies: checked((value) =>
    grantProblem(
      proficienciesIn({ startingProficiencies: value }, false)?.skills,
      CLASS_SKILL_SPEC,
    ),
  ),
  multiclassing: checked(
    (value) =>
      requirementProblem(value) ??
      grantProblem(proficienciesIn({ multiclassing: value }, true)?.skills, CLASS_SKILL_SPEC),
  ),
  casterProgression: casterProgressionSchema.in.shape.casterProgression,
});
