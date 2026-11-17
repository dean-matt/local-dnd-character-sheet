/**
 * What the sheet records about a feature's mechanics, never its rules text: the mechanics
 * it applies, or that it has none. A feature absent from the records is a gap, not a
 * narrative one. A kind joins the vocabulary the day something applies it.
 */
import { z } from "zod";
import { featureKey, refKey } from "./keys.ts";
import { contentRefSchema, featureKeySchema } from "./refs.ts";

const bonusMechanicSchema = z.strictObject({
  kind: z.literal("bonus"),
  target: z.enum(["initiative", "hitPointsPerLevel", "walk"]),
  value: z.union([z.number(), z.literal("proficiency")]),
});

const mechanicSchema = z
  .discriminatedUnion("kind", [bonusMechanicSchema])
  .refine(({ target, value }) => value !== "proficiency" || target === "initiative", {
    error: "only an initiative bonus can be the proficiency bonus",
  });

/** A class or subclass feature carries its whole key; a feat, race trait or the like, its `(name, source)`. */
const featureRefSchema = z.union([featureKeySchema, contentRefSchema]);

export const featureMechanicsSchema = z
  .strictObject({
    ref: featureRefSchema,
    mechanics: z
      .array(mechanicSchema)
      .min(1)
      .refine((all) => new Set(all.map(({ target }) => target)).size === all.length, {
        error: "a feature bonuses each target once",
      })
      .optional(),
    narrative: z.literal(true).optional(),
  })
  .refine((entry) => (entry.mechanics === undefined) !== (entry.narrative === undefined), {
    error: "a feature records its mechanics or the narrative mark, never both or neither",
  });

export type FeatureMechanics = z.infer<typeof featureMechanicsSchema>;

export const featureMechanicsKey = ({ ref }: FeatureMechanics): string =>
  "className" in ref ? featureKey(ref) : refKey(ref);
