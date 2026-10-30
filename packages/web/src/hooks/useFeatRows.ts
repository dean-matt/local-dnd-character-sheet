import { homebrewFeatRecordSchema } from "@dnd/catalog";
import type { CharacterDefinition } from "@dnd/character";
import type { OfferedFeat } from "../lib/improvementFeats.ts";
import { useFeats } from "./useFeats.ts";
import { useHomebrew } from "./useHomebrew.ts";

/**
 * Every feat a character may hold in `edition`, whole: the catalog's, and every homebrew
 * feat whatever its edition or the Homebrew source, since a held feat is read for its
 * choices and increases. `isSuccess` needs both lists, so a failed homebrew read never
 * reads as complete: a held homebrew feat would offer nothing and count as made.
 */
export function useFeatRows(edition: CharacterDefinition["edition"]): {
  rows: OfferedFeat[];
  isSuccess: boolean;
} {
  const catalog = useFeats(edition);
  const homebrew = useHomebrew("feats", homebrewFeatRecordSchema).list;
  return {
    rows: [...(catalog.data?.items ?? []), ...(homebrew.data ?? [])],
    isSuccess: catalog.isSuccess && homebrew.isSuccess,
  };
}
