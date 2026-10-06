import { abilityIncreasesSchema, type IncreaseAlternative } from "@dnd/catalog";
import type { Grantor } from "./increasePicks.ts";
import { useIdentityCatalog } from "./useIdentityCatalog.ts";

export type IncreaseSource = {
  grantedBy: Grantor;
  /** The row's name, for saying where an increase comes from. */
  name: string;
  alternatives: IncreaseAlternative[];
};

/**
 * What the race and the background offer to raise, or `undefined` while a row it reads
 * has not loaded — a failed read included, since reading it as no increase would take
 * back what the row grants. A race or background the catalog does not hold offers nothing.
 */
export function useIncreaseOptions(): IncreaseSource[] | undefined {
  const { catalogRace, raceRow, subraces, subraceRow, raceJson, backgrounds, backgroundRow } =
    useIdentityCatalog();
  const raceRead = catalogRace === undefined || (raceRow.isSuccess && subraces.isSuccess);
  if (!raceRead || !backgrounds.isSuccess) return undefined;
  const subrace = subraceRow?.name ? ` (${subraceRow.name})` : "";
  return [
    {
      grantedBy: "race",
      name: catalogRace ? `${catalogRace.name}${subrace}` : "",
      alternatives: raceJson ? abilityIncreasesSchema.parse(raceJson) : [],
    },
    {
      grantedBy: "background",
      name: backgroundRow?.name ?? "",
      alternatives: backgroundRow ? abilityIncreasesSchema.parse(backgroundRow.json) : [],
    },
  ];
}
