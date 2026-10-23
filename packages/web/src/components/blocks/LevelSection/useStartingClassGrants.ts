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
import { useState } from "react";
import { classQuery } from "../../../hooks/classQuery.ts";
import { useBackgrounds } from "../../../hooks/useBackgrounds.ts";
import { useCatalogSearch } from "../../../hooks/useCatalogSearch.ts";
import { useRace } from "../../../hooks/useRace.ts";
import { useSubraces } from "../../../hooks/useSubraces.ts";
import { ApiError } from "../../../lib/api.ts";
import { resolveGrants, swapGrants } from "../../../lib/proficiencyGrants.ts";
import {
  chosenPicks,
  type MadePicks,
  offeredPicks,
  pickToggles,
  takenPicks,
  withPicks,
} from "./startingPicks.ts";

const catalogOf = (cls: EntryRef) => ("name" in cls ? cls : undefined);
const sameRow = (row: ContentRef, ref: ContentRef | undefined) =>
  ref !== undefined && row.name === ref.name && row.source === ref.source;
/** A row the catalog does not hold, as a typed race's, grants nothing rather than lock Apply. */
const gone = (query: UseQueryResult) =>
  query.error instanceof ApiError && query.error.status === 404;
/** Read, gone, or never asked for, as a homebrew row's. */
const settled = (query: UseQueryResult) =>
  query.isSuccess || gone(query) || (query.isPending && query.fetchStatus === "idle");

/** What the race, the background and each later class's multiclass gains `rows` grant outright. */
function leftInPlace(
  sources: readonly unknown[],
  classes: readonly unknown[],
  hits: Parameters<typeof resolveGrants>[1],
  edition: CharacterDefinition["edition"],
) {
  return resolveGrants(
    [
      ...sources.flatMap((json) => (json ? [proficiencyGrantsSchema.parse(json)] : [])),
      ...classes.map((json) =>
        classProficiencyGrantsSchema.parse(multiclassEntrySchema.parse(json)),
      ),
    ],
    hits,
    edition,
  );
}

/**
 * What the starting class `definition` holds grants outright, what `now` would, and what the
 * sources the change leaves in place still grant: the race or subrace, the background and
 * each later class's multiclass gains, so a proficiency one of them grants stays, as creation
 * keeps it. `swap` is `undefined` where the class is unchanged. A homebrew row grants nothing.
 * The old class's skill and tool picks go back with its grants. The new class's lists come
 * back as `picks`, narrowed to what the character lacks once the swap is made, as a
 * multiclass entry's are, and `swap.now` holds the picks made so far. `ready` is set once
 * every list has as many picks as it asks.
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
  // One edition holds at most 168 skill and language rows, and some fifty mundane tools,
  // each under the route's 200. Past that, a list leaves out the rows beyond the page.
  const names = useCatalogSearch({
    edition,
    type: "skill,language",
    query: "",
    listAll: changed,
    limit: 200,
  });
  const tools = useCatalogSearch({
    edition,
    type: "item",
    query: "",
    listAll: changed,
    limit: 200,
    filters: { kind: "tool", rarity: "none" },
  });
  const [made, setMade] = useState<MadePicks>();

  if (!changed)
    return { swap: undefined, read: true, failed: false, ready: true, picks: undefined };
  const skillHits = names.data?.items ?? [];
  const toolHits = tools.data?.items ?? [];
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
  const stillGranted = leftInPlace(
    [raceJson, backgroundJson],
    laterRows.flatMap((row) => (row.data ? [row.data.json] : [])),
    skillHits,
    edition,
  );
  const wasGranted = grantsOf(was, old.data?.json);
  const nowGranted = grantsOf(now, next.data?.json);

  const taken = takenPicks({
    edition,
    old: catalogOf(was) ? old.data?.json : undefined,
    background: backgroundJson,
    race: raceJson,
    skillHits,
    toolHits,
    granted: [wasGranted, stillGranted],
    held: definition.proficiencies,
  });
  const leaving = withPicks(wasGranted, taken.skills, taken.tools);
  const left = swapGrants(definition.proficiencies, leaving, nowGranted, stillGranted);

  const { skillPick, toolPicks } = offeredPicks({
    edition,
    json: catalogOf(now) ? next.data?.json : undefined,
    skillHits,
    toolHits,
    held: left,
  });
  const mine = made?.cls === entryKey(now) ? made : { cls: entryKey(now), skills: [], tools: [] };
  const { pickedSkills, pickedTools, ready } = chosenPicks(mine, skillPick, toolPicks);

  const queries: UseQueryResult[] = [
    old,
    next,
    raceRow,
    subraces,
    backgrounds,
    names,
    tools,
    ...laterRows,
  ];
  return {
    swap: {
      was: leaving,
      now: withPicks(nowGranted, pickedSkills, pickedTools.flat()),
      still: stillGranted,
    },
    read: queries.every(settled),
    failed: queries.some((query) => query.isError && !gone(query)),
    ready,
    picks: {
      skillPick,
      toolPicks,
      pickedSkills,
      pickedTools,
      ...pickToggles(setMade, { cls: mine.cls, pickedSkills, pickedTools }),
    },
  };
}
