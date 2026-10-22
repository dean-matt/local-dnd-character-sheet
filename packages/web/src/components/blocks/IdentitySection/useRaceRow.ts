import type { SubraceRecord } from "@dnd/catalog";
import type { CharacterDefinition } from "@dnd/character";
import { useRace } from "../../../hooks/useRace.ts";
import { useSubraces } from "../../../hooks/useSubraces.ts";

/**
 * The character's race read from the catalog: its subraces, and `json`, the chosen
 * subrace's row, which already holds its race's, or the race's own. `ready` holds once the
 * read `json` comes from lands, or at once for a homebrew race, which names no catalog row.
 */
export function useRaceRow({ race, subrace, edition }: CharacterDefinition) {
  const catalogRace = "name" in race ? race : undefined;
  const raceRow = useRace(catalogRace);
  const subraces = useSubraces(catalogRace, edition);
  const rows: SubraceRecord[] = subraces.data?.items ?? [];
  const subraceRow = rows.find(
    (row) => subrace !== undefined && row.name === subrace.name && row.source === subrace.source,
  );
  return {
    catalogRace,
    subraces: rows,
    ready: catalogRace === undefined || (subrace ? subraces.isSuccess : raceRow.isSuccess),
    json: subrace ? subraceRow?.json : raceRow.data?.json,
  };
}
