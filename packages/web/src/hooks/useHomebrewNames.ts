import {
  homebrewBackgroundRecordSchema,
  homebrewClassRecordSchema,
  homebrewFeatRecordSchema,
  homebrewRaceRecordSchema,
} from "@dnd/catalog";
import type { HomebrewNames } from "@dnd/character";
import { useMemo } from "react";
import { useHomebrew } from "./useHomebrew.ts";

/**
 * Every homebrew race, class, background and feat name by id, for `displayName` and the
 * summaries. A save to any homebrew row refreshes these queries, so a rename shows at once;
 * a row still loading is absent and reads `Homebrew`.
 */
export function useHomebrewNames(): HomebrewNames {
  const races = useHomebrew("races", homebrewRaceRecordSchema).list.data;
  const classes = useHomebrew("classes", homebrewClassRecordSchema).list.data;
  const backgrounds = useHomebrew("backgrounds", homebrewBackgroundRecordSchema).list.data;
  const feats = useHomebrew("feats", homebrewFeatRecordSchema).list.data;
  return useMemo(
    () =>
      new Map(
        [races, classes, backgrounds, feats].flatMap(
          (rows) => rows?.map(({ id, name }): [string, string] => [id, name]) ?? [],
        ),
      ),
    [races, classes, backgrounds, feats],
  );
}
