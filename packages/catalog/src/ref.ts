/**
 * `POST /refs/resolve`: the `ref` tokens one rendered block of rules text carries, sent
 * together, and the catalog row each one names. The answer is positional — the row for
 * the reference at index `i`, or `null` where the catalog has none.
 */
import { z } from "zod";
import { entriesSchema } from "./entry.ts";

/** One `ref` token's key. An absent `source` means the tag's default, never `""`. */
const refQuerySchema = z.strictObject({
  tag: z.string().min(1),
  name: z.string().min(1),
  source: z.string().min(1).optional(),
});

export type RefQuery = z.infer<typeof refQuerySchema>;

/** Past this a request is refused, a bound on one block rather than a count any block reaches. */
export const MAX_REFS_PER_REQUEST = 1000;

export const refResolveRequestSchema = z.object({
  refs: z.array(refQuerySchema).max(MAX_REFS_PER_REQUEST),
});

/**
 * `path` is the API route that reads the row, absent for a type no route serves — a
 * condition or a creature. `name` and `source` are the row's own, which differ from the
 * reference's in case, in a defaulted source, and after a redirect.
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
