/**
 * A background or feat row's `json`, in the shape `data/backgrounds.json` and
 * `data/feats.json` write an entry — the same "identity, edition, and the whole entry"
 * shape `packages/content/src/load/character-options.ts` loads them with. Models only
 * what a renderer needs to walk — `name`, `source` and `entries` — since neither table
 * derives a column from anything deeper; everything else upstream carries, such as skill
 * proficiencies or a feat's prerequisites, passes through unparsed.
 *
 * A homebrew background or feat's `json` reuses this same shape rather than one of its
 * own — see `homebrewBackgroundInputSchema` and `homebrewFeatInputSchema` below.
 */
import { EDITIONS } from "@dnd/rules";
import { z } from "zod";
import { entriesSchema } from "./entry.ts";

export const characterOptionEntrySchema = z.looseObject({
  name: z.string().min(1),
  source: z.string().min(1),
  entries: entriesSchema.optional(),
});

export type CharacterOptionEntry = z.infer<typeof characterOptionEntrySchema>;

/** A background row from `content.db`'s `backgrounds` table, addressed by `(name, source)`. */
export const backgroundRecordSchema = z.strictObject({
  name: z.string().min(1),
  source: z.string().min(1),
  edition: z.enum(EDITIONS),
  json: characterOptionEntrySchema,
});

export type BackgroundRecord = z.infer<typeof backgroundRecordSchema>;

/**
 * What a caller submits to create or rename a homebrew background. `source` is never
 * here — the server always stamps `HOMEBREW_SOURCE` — and `edition` rides beside the
 * entry rather than inside it, since it is a `homebrew_backgrounds` column, not a field
 * the 5etools shape carries.
 */
export const homebrewBackgroundInputSchema = characterOptionEntrySchema
  .omit({ source: true })
  .extend({ edition: z.enum(EDITIONS) });

export type HomebrewBackgroundInput = z.infer<typeof homebrewBackgroundInputSchema>;

/** A stored homebrew background, as an endpoint returns it. */
export const homebrewBackgroundRecordSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  edition: z.enum(EDITIONS),
  json: characterOptionEntrySchema,
  createdAt: z.iso.datetime(),
});

export type HomebrewBackgroundRecord = z.infer<typeof homebrewBackgroundRecordSchema>;

/** A feat row from `content.db`'s `feats` table, addressed by `(name, source)`. */
export const featRecordSchema = z.strictObject({
  name: z.string().min(1),
  source: z.string().min(1),
  edition: z.enum(EDITIONS),
  json: characterOptionEntrySchema,
});

export type FeatRecord = z.infer<typeof featRecordSchema>;

/**
 * What a caller submits to create or rename a homebrew feat — the same shape and
 * reasoning `homebrewBackgroundInputSchema` gives backgrounds.
 */
export const homebrewFeatInputSchema = characterOptionEntrySchema
  .omit({ source: true })
  .extend({ edition: z.enum(EDITIONS) });

export type HomebrewFeatInput = z.infer<typeof homebrewFeatInputSchema>;

/** A stored homebrew feat, as an endpoint returns it. */
export const homebrewFeatRecordSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  edition: z.enum(EDITIONS),
  json: characterOptionEntrySchema,
  createdAt: z.iso.datetime(),
});

export type HomebrewFeatRecord = z.infer<typeof homebrewFeatRecordSchema>;
