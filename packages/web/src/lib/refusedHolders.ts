import { z } from "zod";
import { ApiError } from "./api.ts";

const namedSchema = z.object({ id: z.string(), name: z.string() });

const refusalSchema = z.object({
  characters: z.array(namedSchema),
  items: z.array(namedSchema).default([]),
});

/**
 * The characters and items a 409 refusal names as holding a homebrew row; none where `error`
 * failed for another reason.
 */
export function refusedHolders(error: Error | null) {
  const none = { characters: [], items: [] };
  if (!(error instanceof ApiError) || error.status !== 409) return none;
  return refusalSchema.safeParse(error.body).data ?? none;
}
