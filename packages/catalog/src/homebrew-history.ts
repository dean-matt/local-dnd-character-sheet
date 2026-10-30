import { EDITIONS } from "@dnd/rules";
import { z } from "zod";

/** The path segment of each kind's routes, `/homebrew/{collection}`. */
const HOMEBREW_COLLECTIONS = [
  "items",
  "spells",
  "races",
  "classes",
  "backgrounds",
  "feats",
  "skills",
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
      edition: z.enum(EDITIONS),
      deletedAt: z.iso.datetime(),
    }),
  ),
});
