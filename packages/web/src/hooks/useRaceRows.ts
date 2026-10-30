import { homebrewRaceRecordSchema } from "@dnd/catalog";
import type { CharacterDefinition, ContentRef } from "@dnd/character";
import { CUSTOM_RACE_SOURCE } from "../lib/customRace.ts";
import { useHomebrew } from "./useHomebrew.ts";
import { useRace } from "./useRace.ts";
import { useSubraces } from "./useSubraces.ts";

const sameRow = (row: ContentRef, ref: ContentRef | undefined) =>
  ref !== undefined && row.name === ref.name && row.source === ref.source;

/**
 * A character's race read from the catalog or from homebrew: the race's row, its subraces
 * and the chosen one, and `json`, the chosen subrace's row, which already holds its race's,
 * or the race's own, or a homebrew race's, which has no subrace. `name` is the race's row
 * name and `read` is true once the row `json` comes from has loaded, or where none is read.
 * A typed race names no row, so `catalogRace` is absent and nothing is fetched.
 */
export function useRaceRows(
  race: CharacterDefinition["race"] | undefined,
  subrace: CharacterDefinition["subrace"],
  edition: CharacterDefinition["edition"],
) {
  const catalogRace =
    race && "name" in race && race.source !== CUSTOM_RACE_SOURCE ? race : undefined;
  const homebrewId = race && "homebrewId" in race ? race.homebrewId : undefined;
  const raceRow = useRace(catalogRace);
  const subraces = useSubraces(catalogRace, edition);
  const homebrew = useHomebrew("races", homebrewRaceRecordSchema, {
    listed: homebrewId !== undefined,
  }).list;
  const homebrewRow = homebrew.data?.find((row) => row.id === homebrewId);
  const subraceRow = subraces.data?.items.find((row) => sameRow(row, subrace));
  return {
    catalogRace,
    raceRow,
    subraces,
    subraceRow,
    name: catalogRace?.name ?? homebrewRow?.name,
    read:
      homebrewId !== undefined
        ? homebrew.isSuccess
        : catalogRace === undefined || (raceRow.isSuccess && subraces.isSuccess),
    json: homebrewRow ? homebrewRow.json : subrace ? subraceRow?.json : raceRow.data?.json,
  };
}
