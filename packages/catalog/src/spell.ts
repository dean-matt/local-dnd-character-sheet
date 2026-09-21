/**
 * A spell entry's `json`, in the shape `vendor/5etools/data/spells/spells-*.json` writes
 * it. Models the fields `packages/content/src/load/spells.ts` reads off an entry to
 * derive `concentration` and `ritual`; everything else upstream carries — range,
 * components, damage type, and the rest — passes through unparsed. A `content.db` spell
 * row and a homebrew one both carry this shape in their `json` column, so one schema
 * validates either.
 *
 * Passthrough rather than strict: see `item.ts` for why homebrew JSON does not carry the
 * same "an open object loses an edit" risk a character definition does.
 */
import { EDITIONS } from "@dnd/rules";
import { z } from "zod";
import { entriesSchema } from "./entry.ts";

const durationSpanSchema = z.looseObject({
  concentration: z.boolean().optional(),
});

const metaSchema = z.looseObject({
  ritual: z.boolean().optional(),
});

export const spellEntrySchema = z.looseObject({
  name: z.string().min(1),
  source: z.string().min(1),
  level: z.int().min(0).max(9),
  school: z.string().min(1),
  duration: z.array(durationSpanSchema).min(1),
  meta: metaSchema.optional(),
  entries: entriesSchema.optional(),
});

export type SpellEntry = z.infer<typeof spellEntrySchema>;

/**
 * What a caller submits to create or rename a homebrew spell. `source` is never here —
 * the server always stamps `HOMEBREW_SOURCE` — and `edition` rides beside the entry
 * rather than inside it, since it is a `homebrew_spells` column, not a field the 5etools
 * shape carries.
 */
export const homebrewSpellInputSchema = spellEntrySchema.omit({ source: true }).extend({
  edition: z.enum(EDITIONS),
});

export type HomebrewSpellInput = z.infer<typeof homebrewSpellInputSchema>;

/** A stored homebrew spell, as an endpoint returns it. */
export const homebrewSpellRecordSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  edition: z.enum(EDITIONS),
  level: z.int().min(0).max(9),
  school: z.string(),
  concentration: z.boolean(),
  ritual: z.boolean(),
  json: spellEntrySchema,
  createdAt: z.iso.datetime(),
});

export type HomebrewSpellRecord = z.infer<typeof homebrewSpellRecordSchema>;

/** A spell row from `content.db`'s `spells` table, addressed by `(name, source)`. */
export const spellRecordSchema = z.strictObject({
  name: z.string().min(1),
  source: z.string().min(1),
  edition: z.enum(EDITIONS),
  level: z.int().min(0).max(9),
  school: z.string().min(1),
  concentration: z.boolean(),
  ritual: z.boolean(),
  json: spellEntrySchema,
});

export type SpellRecord = z.infer<typeof spellRecordSchema>;
