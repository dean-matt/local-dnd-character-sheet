import { catalogRowRecordSchema, optionalFeaturePrerequisitesSchema } from "@dnd/catalog";
import {
  type Ability,
  abilityScore,
  type CharacterDefinition,
  classLevels,
  displayName,
  entryKey,
} from "@dnd/character";
import { useQueries } from "@tanstack/react-query";
import { classQuery } from "../../../../hooks/classQuery.ts";
import { useFeats } from "../../../../hooks/useFeats.ts";
import { apiGet } from "../../../../lib/api.ts";
import type { PrerequisiteRows } from "../../../../lib/levelChoices.ts";
import {
  isPrerequisiteField,
  withPrerequisiteDepartures,
} from "../../../../lib/multiclassPrerequisites.ts";
import { retryUnlessClientError } from "../../../../lib/retryUnlessClientError.ts";
import { prerequisiteOf } from "./useMulticlassEntry.ts";

/**
 * The catalog rows the prerequisites of `definition`'s picks live on: each held option's
 * row, the edition's feats, and each held class's row. `departures` notes every multiclass
 * prerequisite a changed definition leaves unmet, as the level-up does: recorded, never
 * refused. A homebrew option or class needs nothing.
 */
export function useLaterPrerequisites(definition: CharacterDefinition) {
  const options = definition.optionalFeatures.flatMap(({ ref }) => ("name" in ref ? [ref] : []));
  const optionRows = useQueries({
    queries: options.map((ref) => ({
      queryKey: ["catalog", "optfeature", ref.name, ref.source],
      queryFn: () =>
        apiGet(
          `/catalog/optfeature/${encodeURIComponent(ref.name)}/${encodeURIComponent(ref.source)}`,
          catalogRowRecordSchema,
        ),
      retry: retryUnlessClientError,
    })),
  });
  const feats = useFeats(definition.edition);
  const groups = classLevels(definition);
  const classRows = useQueries({
    queries: groups.map((group) => classQuery("name" in group.class ? group.class : undefined)),
  });

  const rows: PrerequisiteRows = {
    options: new Map(
      options.map((ref, index) => [
        entryKey(ref),
        optionalFeaturePrerequisitesSchema.parse(optionRows[index]?.data?.json.prerequisite),
      ]),
    ),
    feats: feats.data?.items ?? [],
  };
  const departures = (after: CharacterDefinition) =>
    withPrerequisiteDepartures(
      after.departures,
      groups.map((group, index) => ({
        name: displayName(group.class),
        firstIndex: after.levels.findIndex(
          (level) => entryKey(level.class) === entryKey(group.class),
        ),
        prerequisite: prerequisiteOf(group.class, classRows[index]?.data?.json),
      })),
      (ability: Ability) => abilityScore(after, ability),
    );
  return {
    rows,
    departures,
    /** The multiclass notes `after` adds to what the definition already notes. */
    addedNotes: (after: CharacterDefinition) => {
      const noted = new Set(
        definition.departures
          .filter((each) => isPrerequisiteField(each.field))
          .map((each) => each.note),
      );
      return departures(after)
        .filter((each) => isPrerequisiteField(each.field) && !noted.has(each.note))
        .map((each) => each.note);
    },
    read:
      feats.isSuccess &&
      optionRows.every((row) => row.isSuccess) &&
      groups.every((group, index) => !("name" in group.class) || classRows[index]?.isSuccess),
    failed: [...optionRows, feats, ...classRows].some((query) => query.isError),
  };
}
