import {
  HOMEBREW_SOURCE,
  homebrewRaceRecordSchema,
  type RaceRecord,
  type SubraceRecord,
} from "@dnd/catalog";
import type { CharacterDefinition } from "@dnd/character";
import { CUSTOM_RACE_SOURCE } from "../lib/customRace.ts";
import { heldSubrace, type SubraceItem } from "../lib/subraceItems.ts";
import { useHomebrew } from "./useHomebrew.ts";
import { useRace } from "./useRace.ts";
import { useSubraces } from "./useSubraces.ts";

/** A catalog subrace's row, which holds its race's, or the race's own where none is held. */
const catalogJson = (
  subrace: CharacterDefinition["subrace"],
  subraceRow: SubraceItem | undefined,
  raceJson: RaceRecord["json"] | undefined,
): RaceRecord["json"] | SubraceRecord["json"] | undefined => {
  if (!subrace || "homebrewId" in subrace) return raceJson;
  return subraceRow && "source" in subraceRow ? subraceRow.json : undefined;
};

/**
 * A character's race read from the catalog or from homebrew: the race's row, its catalog
 * and homebrew subraces and the chosen one, and `json`, a catalog subrace's row, which
 * already holds its race's, or the race's own, or a homebrew race's. A homebrew subrace adds
 * nothing to its race's `json`. `name` is the race's row name and `read` is true once the
 * row `json` comes from has loaded, or where none is read. A typed race names no row, so
 * `catalogRace` is absent and nothing is fetched.
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
  const homebrew = useHomebrew("races", homebrewRaceRecordSchema, {
    listed: homebrewId !== undefined,
  }).list;
  const homebrewRow = homebrew.data?.find((row) => row.id === homebrewId);
  const subraces = useSubraces(
    catalogRace ?? (homebrewRow && { name: homebrewRow.name, source: HOMEBREW_SOURCE }),
    edition,
  );
  const subraceRow = heldSubrace(subraces.data?.items, subrace);
  return {
    catalogRace,
    raceRow,
    subraces,
    subraceRow,
    homebrew,
    name: catalogRace?.name ?? homebrewRow?.name,
    read:
      homebrewId !== undefined
        ? homebrew.isSuccess
        : catalogRace === undefined || (raceRow.isSuccess && subraces.isSuccess),
    json: homebrewRow ? homebrewRow.json : catalogJson(subrace, subraceRow, raceRow.data?.json),
  };
}
