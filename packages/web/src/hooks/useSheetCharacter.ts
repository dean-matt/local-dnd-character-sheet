import type { CharacterRecord } from "@dnd/character";
import { useMatch, useSearchParams } from "react-router";
import { useCharacters } from "./useCharacters.ts";

/** The `/search` parameter naming the character whose sheet the search was opened from. */
export const SEARCHED_FROM = "for";

/**
 * The character whose sheet is open: the one under `/characters/:id`, or on `/search` the
 * one its `for` parameter names. `undefined` anywhere else, during creation, and while the
 * list loads or no longer holds that character.
 */
export function useSheetCharacter(): CharacterRecord | undefined {
  const sheet = useMatch("/characters/:id/*")?.params.id;
  const onSearch = useMatch("/search") !== null;
  const [params] = useSearchParams();
  const characters = useCharacters();
  const id =
    sheet !== undefined && sheet !== "new" ? sheet : onSearch ? params.get(SEARCHED_FROM) : null;
  return id === null ? undefined : characters.data?.find((character) => character.id === id);
}
