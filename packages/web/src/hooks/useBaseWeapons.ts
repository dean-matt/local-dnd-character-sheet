import { itemRecordSchema } from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

const baseWeaponListSchema = z.object({ items: z.array(itemRecordSchema), total: z.int() });

/**
 * Every catalog base weapon in one edition, the rows a weapon's `baseItem` names. 200 is
 * the route's ceiling, near four times the 54 the larger edition holds; past it, the
 * weapons beyond go unoffered until this pages.
 */
export function useBaseWeapons(edition: CharacterRecord["edition"]) {
  return useQuery({
    queryKey: ["baseWeapons", edition],
    queryFn: () =>
      apiGet(`/items?edition=${edition}&baseWeapons=true&limit=200`, baseWeaponListSchema),
    retry: retryUnlessClientError,
  });
}
