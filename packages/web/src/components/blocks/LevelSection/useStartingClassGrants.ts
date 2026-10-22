import {
  classProficiencyGrantsSchema,
  multiclassEntrySchema,
  proficiencyGrantsSchema,
} from "@dnd/catalog";
import {
  type CharacterDefinition,
  type ContentRef,
  classLevels,
  type EntryRef,
  entryKey,
} from "@dnd/character";
import { type UseQueryResult, useQueries, useQuery } from "@tanstack/react-query";
import { classQuery } from "../../../hooks/classQuery.ts";
import { useBackgrounds } from "../../../hooks/useBackgrounds.ts";
import { useRace } from "../../../hooks/useRace.ts";
import { useSubraces } from "../../../hooks/useSubraces.ts";
import { ApiError } from "../../../lib/api.ts";
import { resolveGrants } from "../../../lib/proficiencyGrants.ts";

const catalogOf = (cls: EntryRef) => ("name" in cls ? cls : undefined);
const sameRow = (row: ContentRef, ref: ContentRef | undefined) =>
  ref !== undefined && row.name === ref.name && row.source === ref.source;
/** A row the catalog does not hold, as a typed race's, grants nothing rather than lock Apply. */
const gone = (query: UseQueryResult) =>
  query.error instanceof ApiError && query.error.status === 404;
/** Read, gone, or never asked for, as a homebrew row's. */
const settled = (query: UseQueryResult) =>
  query.isSuccess || gone(query) || (query.isPending && query.fetchStatus === "idle");

/**
 * What the starting class `definition` holds grants outright, what `now` would, and what the
 * sources the change leaves in place still grant: the race or subrace, the background and
 * each later class's multiclass gains, so a proficiency one of them grants stays, as creation
 * keeps it. `swap` is `undefined` where the class is unchanged. A homebrew row grants nothing.
 * Skills and languages resolve against no rows, since no class grants one outright and only
 * a class's grants are taken back.
 */
export function useStartingClassGrants(definition: CharacterDefinition, now: EntryRef | undefined) {
  const { edition, race, subrace, background } = definition;
  const was = definition.levels[0]?.class;
  const changed = was !== undefined && now !== undefined && entryKey(was) !== entryKey(now);
  const old = useQuery(classQuery(changed ? catalogOf(was) : undefined));
  const next = useQuery(classQuery(changed ? catalogOf(now) : undefined));
  const catalogRace = changed && "name" in race ? race : undefined;
  const raceRow = useRace(catalogRace);
  const subraces = useSubraces(subrace ? catalogRace : undefined, edition);
  const backgrounds = useBackgrounds(edition, changed && "name" in background);
  const later = classLevels(definition).filter(
    (group) => was !== undefined && entryKey(group.class) !== entryKey(was),
  );
  const laterRows = useQueries({
    queries: later.map((group) => classQuery(changed ? catalogOf(group.class) : undefined)),
  });

  if (!changed) return { swap: undefined, read: true, failed: false };
  const grantsOf = (cls: EntryRef, json: unknown) =>
    resolveGrants(
      catalogOf(cls) && json ? [classProficiencyGrantsSchema.parse(json)] : [],
      [],
      edition,
    );
  const raceJson = subrace
    ? subraces.data?.items.find((row) => sameRow(row, subrace))?.json
    : raceRow.data?.json;
  const backgroundJson =
    "name" in background
      ? backgrounds.data?.items.find((row) => sameRow(row, background))?.json
      : undefined;
  const still = [raceJson, backgroundJson].flatMap((json) =>
    json ? [proficiencyGrantsSchema.parse(json)] : [],
  );
  const gains = laterRows.flatMap((row) =>
    row.data
      ? [classProficiencyGrantsSchema.parse(multiclassEntrySchema.parse(row.data.json))]
      : [],
  );
  const queries: UseQueryResult[] = [old, next, raceRow, subraces, backgrounds, ...laterRows];
  return {
    swap: {
      was: grantsOf(was, old.data?.json),
      now: grantsOf(now, next.data?.json),
      still: resolveGrants([...still, ...gains], [], edition),
    },
    read: queries.every(settled),
    failed: queries.some((query) => query.isError && !gone(query)),
  };
}
