import type { CharacterDefinition, ContentRef } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { useBackgrounds } from "../../hooks/useBackgrounds.ts";
import { useCatalogSearch } from "../../hooks/useCatalogSearch.ts";
import { useRace } from "../../hooks/useRace.ts";
import { useSubraces } from "../../hooks/useSubraces.ts";

/** The source a race typed past the catalog is stored under, so no catalog row answers it. */
export const CUSTOM_RACE_SOURCE = "Custom";

const sameRow = (row: ContentRef, ref: ContentRef | undefined) =>
  ref !== undefined && row.name === ref.name && row.source === ref.source;

/**
 * The catalog rows the Identity step's choices name: the race, its subraces and the chosen
 * one, every background of the edition, and the skill and language rows a grant resolves
 * against. `raceJson` is the chosen subrace's row, which already holds its race's, or the
 * race's own. A typed or homebrew race names no catalog row, so `catalogRace` is absent.
 */
export function useIdentityCatalog() {
  const [edition = "one", race, subrace, background] = useWatch<
    CharacterDefinition,
    ["edition", "race", "subrace", "background"]
  >({ name: ["edition", "race", "subrace", "background"] });
  const catalogRace =
    race && "name" in race && race.source !== CUSTOM_RACE_SOURCE ? race : undefined;
  const raceRow = useRace(catalogRace);
  const subraces = useSubraces(catalogRace, edition);
  const backgrounds = useBackgrounds(edition);
  // One edition holds at most 168 skill and language rows, under the route's 200. Past
  // that, a grant naming a row beyond the page resolves to nothing.
  const names = useCatalogSearch({
    edition,
    type: "skill,language",
    query: "",
    listAll: true,
    limit: 200,
  });
  const subraceRow = subraces.data?.items.find((row) => sameRow(row, subrace));
  const catalogBackground = background && "name" in background ? background : undefined;
  return {
    edition,
    catalogRace,
    raceRow,
    subraces,
    subraceRow,
    raceJson: subrace ? subraceRow?.json : raceRow.data?.json,
    backgrounds,
    backgroundRow: backgrounds.data?.items.find((row) => sameRow(row, catalogBackground)),
    names,
  };
}
