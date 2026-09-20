/**
 * An item row's `json`, in the shape `vendor/5etools/data/items.json` writes it. Models
 * the fields the content loader (`packages/content/src/load/items.ts`) and a renderer
 * read off an entry; everything else upstream carries — weight, value, damage dice, and
 * every field specific to one item `type` — passes through unparsed.
 *
 * Passthrough rather than strict, departing from `packages/character/src/character.ts`:
 * a character definition is read, edited field by field and written back whole, so an
 * open object silently drops an edit on save. Homebrew JSON is written once and
 * displayed, never edited in place — `packages/character` itself only ever *references*
 * a homebrew row by id — so the risk strict guards against does not apply, and it would
 * instead reject an item pasted straight out of a 5etools-shaped source for carrying a
 * field this schema has not modeled yet.
 */
import { EDITIONS } from "@dnd/rules";
import { z } from "zod";
import { entriesSchema } from "./entry.ts";

/**
 * `true`, a condition such as `"by a spellcaster"`, or `"optional"` — the shape
 * `packages/content/src/load/items.ts`'s `requiresAttunement` already reads.
 */
const reqAttuneSchema = z.union([z.boolean(), z.string().min(1)]);

export const homebrewItemSchema = z.looseObject({
  name: z.string().min(1),
  source: z.string().min(1),
  type: z.string().min(1).optional(),
  rarity: z.string().min(1).optional(),
  reqAttune: reqAttuneSchema.optional(),
  entries: entriesSchema.optional(),
});

export type HomebrewItem = z.infer<typeof homebrewItemSchema>;

/**
 * What a caller submits to create or rename a homebrew item. `source` is never here — the
 * server always stamps `HOMEBREW_SOURCE` — and `edition` rides beside the entry rather
 * than inside it, since it is a `homebrew_items` column, not a field the 5etools shape
 * carries.
 */
export const homebrewItemInputSchema = homebrewItemSchema.omit({ source: true }).extend({
  edition: z.enum(EDITIONS),
});

export type HomebrewItemInput = z.infer<typeof homebrewItemInputSchema>;

/** A stored homebrew item, as an endpoint returns it. */
export const homebrewItemRecordSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  edition: z.enum(EDITIONS),
  type: z.string().nullable(),
  rarity: z.string().nullable(),
  requiresAttunement: z.boolean(),
  json: homebrewItemSchema,
  createdAt: z.iso.datetime(),
});

export type HomebrewItemRecord = z.infer<typeof homebrewItemRecordSchema>;
