import { EDITIONS } from "@dnd/rules";
import { z } from "zod";

/** The path segment of each kind's routes, `/homebrew/{collection}`. */
const HOMEBREW_COLLECTIONS = [
  "items",
  "spells",
  "races",
  "subraces",
  "classes",
  "subclasses",
  "backgrounds",
  "feats",
  "skills",
  "deities",
  "optional-features",
] as const;

export const homebrewCollectionSchema = z.enum(HOMEBREW_COLLECTIONS);

/**
 * What the API holds in memory to undo a homebrew change: the rows whose last save can be
 * reverted, and the rows deleted since it started, newest first.
 */
export const homebrewHistorySchema = z.strictObject({
  reversible: z.array(z.strictObject({ collection: homebrewCollectionSchema, id: z.string() })),
  deleted: z.array(
    z.strictObject({
      collection: homebrewCollectionSchema,
      id: z.string(),
      name: z.string(),
      /** Absent on a deity, which belongs to neither ruleset. */
      edition: z.enum(EDITIONS).optional(),
      deletedAt: z.iso.datetime(),
    }),
  ),
});
