import {
  homebrewBackgroundRecordSchema,
  homebrewClassRecordSchema,
  homebrewFeatRecordSchema,
  homebrewRaceRecordSchema,
  homebrewSubclassRecordSchema,
} from "@dnd/catalog";
import type { HomebrewNames } from "@dnd/character";
import { useMemo } from "react";
import { LISTING_KINDS } from "../lib/homebrewListing.ts";
import { useHomebrew } from "./useHomebrew.ts";

/**
 * Every homebrew race, subrace, class, subclass, background and feat name by id, for `displayName` and the
 * summaries. A save to any homebrew row refreshes these queries, so a rename shows at once;
 * a row still loading is absent and reads `Homebrew`.
 */
export function useHomebrewNames(): HomebrewNames {
  const races = useHomebrew("races", homebrewRaceRecordSchema).list.data;
  const classes = useHomebrew("classes", homebrewClassRecordSchema).list.data;
  const backgrounds = useHomebrew("backgrounds", homebrewBackgroundRecordSchema).list.data;
  const feats = useHomebrew("feats", homebrewFeatRecordSchema).list.data;
  const subclasses = useHomebrew("subclasses", homebrewSubclassRecordSchema).list.data;
  // A query key caches one parse of its rows, so this parses them as the Homebrew page does.
  const subraces = useHomebrew("subraces", LISTING_KINDS.subraces.recordSchema).list.data;
  return useMemo(
    () =>
      new Map(
        [races, subraces, classes, backgrounds, feats, subclasses].flatMap(
          (rows) => rows?.map(({ id, name }): [string, string] => [id, name]) ?? [],
        ),
      ),
    [races, subraces, classes, backgrounds, feats, subclasses],
  );
}
