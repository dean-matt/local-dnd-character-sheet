/**
 * A spell row's `json`, in the shape `vendor/5etools/data/spells/spells-*.json` writes
 * it. Models the fields `packages/content/src/load/spells.ts` reads off an entry to
 * derive `concentration` and `ritual`; everything else upstream carries — range,
 * components, damage type, and the rest — passes through unparsed.
 *
 * Passthrough rather than strict: see `item.ts` for why homebrew JSON does not carry the
 * same "an open object loses an edit" risk a character definition does.
 */
import { z } from "zod";
import { entriesSchema } from "./entry.ts";

const durationSpanSchema = z.looseObject({
  concentration: z.boolean().optional(),
});

const metaSchema = z.looseObject({
  ritual: z.boolean().optional(),
});

export const homebrewSpellSchema = z.looseObject({
  name: z.string().min(1),
  source: z.string().min(1),
  level: z.int().min(0).max(9),
  school: z.string().min(1),
  duration: z.array(durationSpanSchema).min(1),
  meta: metaSchema.optional(),
  entries: entriesSchema.optional(),
});

export type HomebrewSpell = z.infer<typeof homebrewSpellSchema>;
