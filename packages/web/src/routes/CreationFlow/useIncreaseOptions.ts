import { type CharacterDefinition, houseRule } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { type IncreaseSource, increaseSource } from "../../lib/grantorIncreases.ts";
import { useIdentityCatalog } from "./useIdentityCatalog.ts";

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
  const freed = houseRule({ houseRules: houseRules ?? {} }, "customOrigin");
  const raceRead = catalogRace === undefined || (raceRow.isSuccess && subraces.isSuccess);
  if (!raceRead || !backgrounds.isSuccess) return undefined;
  const subrace = subraceRow?.name ? ` (${subraceRow.name})` : "";
  return [
    increaseSource("race", catalogRace ? `${catalogRace.name}${subrace}` : "", raceJson, freed),
    increaseSource("background", backgroundRow?.name ?? "", backgroundRow?.json),
  ];
}
