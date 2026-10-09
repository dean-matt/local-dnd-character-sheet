import { abilityIncreasesSchema, customOrigin, type IncreaseAlternative } from "@dnd/catalog";
import { type CharacterDefinition, houseRule } from "@dnd/character";
import { useWatch } from "react-hook-form";
import type { Grantor } from "./grantorIncreases.ts";
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
 * back what the row grants. A race or background the catalog does not hold offers nothing,
 * and the custom-origin house rule frees a race's increases to any ability.
 */
export function useIncreaseOptions(): IncreaseSource[] | undefined {
  const { catalogRace, raceRow, subraces, subraceRow, raceJson, backgrounds, backgroundRow } =
    useIdentityCatalog();
  const houseRules = useWatch<CharacterDefinition, "houseRules">({ name: "houseRules" });
  const origin = houseRule({ houseRules: houseRules ?? {} }, "customOrigin")
    ? customOrigin
    : (alternatives: IncreaseAlternative[]) => alternatives;
  const raceRead = catalogRace === undefined || (raceRow.isSuccess && subraces.isSuccess);
  if (!raceRead || !backgrounds.isSuccess) return undefined;
  const subrace = subraceRow?.name ? ` (${subraceRow.name})` : "";
  return [
    {
      grantedBy: "race",
      name: catalogRace ? `${catalogRace.name}${subrace}` : "",
      alternatives: raceJson ? origin(abilityIncreasesSchema.parse(raceJson)) : [],
    },
    {
      grantedBy: "background",
      name: backgroundRow?.name ?? "",
      alternatives: backgroundRow ? abilityIncreasesSchema.parse(backgroundRow.json) : [],
    },
  ];
}
