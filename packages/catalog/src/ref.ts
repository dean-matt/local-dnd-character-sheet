/**
 * `POST /refs/resolve`: the `ref` tokens one rendered block of rules text carries, sent
 * together, and the catalog or homebrew row each one names. The answer is positional —
 * the row for the reference at index `i`, or `null` where neither has one.
 */
import { z } from "zod";
import { entriesSchema } from "./entry.ts";

/**
 * The rest of a class or subclass feature's key, which `(name, source)` alone does not
 * identify. An absent source means `PHB`, as upstream reads it.
 */
const featureOwnerSchema = z.strictObject({
  className: z.string().min(1),
  classSource: z.string().min(1).optional(),
  subclassShortName: z.string().min(1).optional(),
  subclassSource: z.string().min(1).optional(),
  level: z.int().min(1).max(20),
});

/** One `ref` token's key. An absent `source` means the tag's default, never `""`. */
const refQuerySchema = z.strictObject({
  tag: z.string().min(1),
  name: z.string().min(1),
  source: z.string().min(1).optional(),
  owner: featureOwnerSchema.optional(),
});

export type RefQuery = z.infer<typeof refQuerySchema>;

/** Past this a request is refused, a bound on one block rather than a count any block reaches. */
export const MAX_REFS_PER_REQUEST = 1000;

export const refResolveRequestSchema = z.object({
  refs: z.array(refQuerySchema).max(MAX_REFS_PER_REQUEST),
});

/**
 * `path` is the row's detail address, which the sheet opens in a modal. For most rows that
 * is the API route that reads it — `/catalog/{type}/{name}/{source}` for a type with no
 * route of its own, such as a condition; the sheet reads a feature from its class's grants
 * instead. It is absent for a row of such a type with no prose, as a creature has none.
 * `name` and `source` are the row's own, which differ from the reference's in case, in a
 * defaulted source, and after a redirect. A subrace answers with its merged name, `Human (Keldon)` where the row
 * reads `Keldon`.
 */
const resolvedRefSchema = z.strictObject({
  name: z.string().min(1),
  source: z.string().min(1),
  entries: entriesSchema,
  path: z.string().startsWith("/").optional(),
});

export type ResolvedRef = z.infer<typeof resolvedRefSchema>;

export const refResolveResponseSchema = z.object({
  refs: z.array(resolvedRefSchema.nullable()),
});
