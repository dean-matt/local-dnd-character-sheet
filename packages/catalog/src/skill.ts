/**
 * A homebrew skill's `json`, in the shape a `lookups` skill row writes: a name, a source and
 * the ability it uses, with optional rules text. A character references one by
 * `(name, source)` from its skill proficiencies, and an item's advantage effect names it by
 * `name`, so a rename is refused while either holds it.
 */
import { ABILITIES, EDITIONS } from "@dnd/rules";
import { z } from "zod";
import { entriesSchema } from "./entry.ts";

export const skillEntrySchema = z.looseObject({
  name: z.string().min(1),
  source: z.string().min(1),
  ability: z.enum(ABILITIES),
  entries: entriesSchema.optional(),
});

/**
 * A homebrew skill's entry: the 5etools shape with one more ability, `flat`, for a skill whose
 * base is a number each character holding it sets. Only homebrew carries it, so the catalog
 * shape above stays the one upstream prints.
 */
export const homebrewSkillEntrySchema = skillEntrySchema.extend({
  ability: z.enum([...ABILITIES, "flat"]),
});

export type HomebrewSkillEntry = z.infer<typeof homebrewSkillEntrySchema>;

/**
 * What a caller submits to create or rename a homebrew skill. `source` is never here — the
 * server always stamps `HOMEBREW_SOURCE` — and `edition` rides beside the entry, since it is
 * a `homebrew_skills` column, not a field the 5etools shape carries.
 */
export const homebrewSkillInputSchema = homebrewSkillEntrySchema
  .omit({ source: true })
  .extend({ edition: z.enum(EDITIONS) });

export type HomebrewSkillInput = z.infer<typeof homebrewSkillInputSchema>;

/** A stored homebrew skill, as an endpoint returns it. */
export const homebrewSkillRecordSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  edition: z.enum(EDITIONS),
  json: homebrewSkillEntrySchema,
  createdAt: z.iso.datetime(),
});

export type HomebrewSkillRecord = z.infer<typeof homebrewSkillRecordSchema>;
