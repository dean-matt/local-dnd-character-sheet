/**
 * A background or feat row's `json`, in the shape `data/backgrounds.json` and
 * `data/feats.json` write an entry — the same "identity, edition, and the whole entry"
 * shape `packages/content/src/load/character-options.ts` loads them with. Models only
 * what a renderer needs to walk — `name`, `source` and `entries` — since neither table
 * derives a column from anything deeper; everything else upstream carries, such as skill
 * proficiencies or a feat's prerequisites, passes through unparsed.
 */
import { EDITIONS } from "@dnd/rules";
import { z } from "zod";
import { entriesSchema } from "./entry.ts";

const characterOptionEntrySchema = z.looseObject({
  name: z.string().min(1),
  source: z.string().min(1),
  entries: entriesSchema.optional(),
});

/** A background row from `content.db`'s `backgrounds` table, addressed by `(name, source)`. */
export const backgroundRecordSchema = z.strictObject({
  name: z.string().min(1),
  source: z.string().min(1),
  edition: z.enum(EDITIONS),
  json: characterOptionEntrySchema,
});

export type BackgroundRecord = z.infer<typeof backgroundRecordSchema>;

/** A feat row from `content.db`'s `feats` table, addressed by `(name, source)`. */
export const featRecordSchema = z.strictObject({
  name: z.string().min(1),
  source: z.string().min(1),
  edition: z.enum(EDITIONS),
  json: characterOptionEntrySchema,
});

export type FeatRecord = z.infer<typeof featRecordSchema>;
