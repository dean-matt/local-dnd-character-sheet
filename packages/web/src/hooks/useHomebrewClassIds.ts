import { homebrewClassRecordSchema } from "@dnd/catalog";
import type { CharacterDefinition, EntryRef } from "@dnd/character";
import { homebrewClassByName, homebrewClassId } from "../lib/catalogClass.ts";
import { useHomebrew } from "./useHomebrew.ts";

/**
 * The homebrew class id each of `classes` cites, as `homebrewClassId` reads it, listing the
 * homebrew classes only where one is cited by `(name, "HB")`. `loading` holds while that list
 * loads; `unmatched` holds of a name citation the loaded list has no class for.
 */
export function useHomebrewClassIds(
  classes: readonly EntryRef[],
  edition: CharacterDefinition["edition"],
) {
  const { list } = useHomebrew("classes", homebrewClassRecordSchema, {
    listed: classes.some((cls) => homebrewClassByName(cls) !== undefined),
  });
  const ids = classes.map((cls) => homebrewClassId(cls, list.data, edition));
  return {
    ids,
    loading: list.isLoading,
    unmatched: classes.map(
      (cls, index) =>
        homebrewClassByName(cls) !== undefined && list.isSuccess && ids[index] === undefined,
    ),
  };
}
