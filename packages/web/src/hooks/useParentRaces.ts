import { homebrewRaceRecordSchema, raceRecordSchema } from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet } from "../lib/api.ts";
import { useHomebrew } from "./useHomebrew.ts";

/** One race a subrace can belong to, as the subrace input's `parent` names it. */
interface ParentRace {
  parent: { name: string; source: string } | { raceId: string };
  label: string;
}

const MAX_RACES = 200;
const catalogRacesSchema = z.object({ items: z.array(raceRecordSchema) });

/**
 * The races of one edition a homebrew subrace can belong to, catalog races first and
 * homebrew races after, each race in its own edition only. `pending` and `error` speak
 * for both reads.
 */
export function useParentRaces(edition: CharacterRecord["edition"]) {
  const catalog = useQuery({
    queryKey: ["races", "parents", edition],
    queryFn: () => apiGet(`/races?edition=${edition}&limit=${MAX_RACES}`, catalogRacesSchema),
  });
  const { list } = useHomebrew("races", homebrewRaceRecordSchema);
  const races: ParentRace[] = [
    ...(catalog.data?.items ?? []).map(({ name, source }) => ({
      parent: { name, source },
      label: `${name} (${source})`,
    })),
    ...(list.data ?? [])
      .filter((row) => row.edition === edition)
      .map(({ id, name }) => ({ parent: { raceId: id }, label: `${name} (Homebrew)` })),
  ];
  return {
    races,
    pending: catalog.isPending || list.isPending,
    error: catalog.error ?? list.error,
  };
}
