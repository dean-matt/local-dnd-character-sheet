import { catalogRowRecordSchema, optionalFeaturePrerequisitesSchema } from "@dnd/catalog";
import { type CharacterDefinition, classLevels, displayName, entryKey } from "@dnd/character";
import { useQueries } from "@tanstack/react-query";
import { classQuery } from "../../../../hooks/classQuery.ts";
import { useFeats } from "../../../../hooks/useFeats.ts";
import { ApiError, apiGet } from "../../../../lib/api.ts";
import { levelChoiceDepartures, type PrerequisiteRows } from "../../../../lib/levelChoices.ts";
import { retryUnlessClientError } from "../../../../lib/retryUnlessClientError.ts";
import { prerequisiteOf } from "./useMulticlassEntry.ts";

/**
 * The catalog rows the prerequisites of `definition`'s picks live on: each held option's
 * row, the edition's feats, and each held class's row, and the multiclass departures a changed
 * definition carries. A homebrew option or class needs nothing.
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
  const judged = groups.map((group, index) => ({
    name: displayName(group.class),
    firstIndex: definition.levels.findIndex(
      (level) => entryKey(level.class) === entryKey(group.class),
    ),
    prerequisite: prerequisiteOf(group.class, classRows[index]?.data?.json),
  }));
  /** An option whose row is gone, renamed upstream since, needs nothing rather than locking Apply. */
  const gone = (row: (typeof optionRows)[number]) =>
    row.error instanceof ApiError && row.error.status === 404;
  return {
    rows,
    departures: (after: CharacterDefinition) => levelChoiceDepartures(definition, after, judged),
    read:
      feats.isSuccess &&
      optionRows.every((row) => row.isSuccess || gone(row)) &&
      groups.every((group, index) => !("name" in group.class) || classRows[index]?.isSuccess),
    failed:
      optionRows.some((row) => row.isError && !gone(row)) ||
      [feats, ...classRows].some((query) => query.isError),
  };
}
