import type { CharacterDefinition, ContentRef } from "@dnd/character";
import { CUSTOM_RACE_SOURCE } from "../lib/customRace.ts";
import { useRace } from "./useRace.ts";
import { useSubraces } from "./useSubraces.ts";

const sameRow = (row: ContentRef, ref: ContentRef | undefined) =>
  ref !== undefined && row.name === ref.name && row.source === ref.source;

/**
 * A character's race read from the catalog: the race's row, its subraces and the chosen
 * one, and `json`, the chosen subrace's row, which already holds its race's, or the race's
 * own. A typed or homebrew race names no catalog row, so `catalogRace` is absent and
 * nothing is fetched.
 */
export function useRaceRows(
  race: CharacterDefinition["race"] | undefined,
  subrace: CharacterDefinition["subrace"],
  edition: CharacterDefinition["edition"],
) {
  const catalogRace =
    race && "name" in race && race.source !== CUSTOM_RACE_SOURCE ? race : undefined;
  const raceRow = useRace(catalogRace);
  const subraces = useSubraces(catalogRace, edition);
  const subraceRow = subraces.data?.items.find((row) => sameRow(row, subrace));
  return {
    catalogRace,
    raceRow,
    subraces,
    subraceRow,
    json: subrace ? subraceRow?.json : raceRow.data?.json,
  };
}
