/**
 * A homebrew deity's `json`, in the shape a `lookups` deity row writes. A character cites one
 * by `(name, source, pantheon)`, the key a catalog deity has; no edition rides beside it,
 * because a catalog deity carries none either.
 */
import { z } from "zod";
import { entriesSchema } from "./entry.ts";

/** Upstream's letters: `L`awful, `N`eutral, `C`haotic, `G`ood, `E`vil, `U`naligned, `A`ny. */
const ALIGNMENT_LETTERS = ["L", "N", "C", "G", "E", "U", "A"] as const;

export const homebrewDeityEntrySchema = z.looseObject({
  name: z.string().min(1),
  source: z.string().min(1),
  pantheon: z.string().min(1),
  alignment: z.array(z.enum(ALIGNMENT_LETTERS)).optional(),
  domains: z.array(z.string().min(1)).optional(),
  title: z.string().min(1).optional(),
  entries: entriesSchema.optional(),
});

export type HomebrewDeity = z.infer<typeof homebrewDeityEntrySchema>;

/** What a caller submits to create or replace a homebrew deity; the server stamps `source`. */
export const homebrewDeityInputSchema = homebrewDeityEntrySchema.omit({ source: true });

export type HomebrewDeityInput = z.infer<typeof homebrewDeityInputSchema>;

/** A stored homebrew deity, as an endpoint returns it. */
export const homebrewDeityRecordSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  pantheon: z.string(),
  json: homebrewDeityEntrySchema,
  createdAt: z.iso.datetime(),
});

export type HomebrewDeityRecord = z.infer<typeof homebrewDeityRecordSchema>;
