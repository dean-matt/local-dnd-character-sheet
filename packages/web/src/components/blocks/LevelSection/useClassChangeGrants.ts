import {
  classProficiencyGrantsSchema,
  multiclassEntrySchema,
  proficiencyGrantsSchema,
  type SearchHit,
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
import { NO_GRANTS, resolveGrants, swapGrants } from "../../../lib/proficiencyGrants.ts";
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

/** What the race, the background, the starting class and each other class's multiclass gains grant outright. */
function leftInPlace(
  sources: readonly unknown[],
  starting: readonly unknown[],
  entered: readonly unknown[],
  hits: Parameters<typeof resolveGrants>[1],
  edition: CharacterDefinition["edition"],
) {
  return resolveGrants(
    [
      ...sources.flatMap((json) => (json ? [proficiencyGrantsSchema.parse(json)] : [])),
      ...starting.map((json) => classProficiencyGrantsSchema.parse(json)),
      ...entered.map((json) =>
        classProficiencyGrantsSchema.parse(multiclassEntrySchema.parse(json)),
      ),
    ],
    hits,
    edition,
  );
}

type Change = {
  was: EntryRef;
  now: EntryRef;
  /** Level 1 trades starting proficiencies, a later level multiclass gains. */
  first: boolean;
  /** The old class's grants go back: this was its one level. */
  oldGoes: boolean;
  /** The new class's grants land: the character held none of it. */
  newComes: boolean;
};

/** The class change `now` makes at `level`, or `undefined` where the class is the one it holds. */
function classChange(
  definition: CharacterDefinition,
  level: number,
  now: EntryRef | undefined,
): Change | undefined {
  const was = definition.levels[level - 1]?.class;
  if (was === undefined || now === undefined || entryKey(was) === entryKey(now)) return undefined;
  const first = level === 1;
  const elsewhere = new Set(
    definition.levels.flatMap((each, index) => (index === level - 1 ? [] : [entryKey(each.class)])),
  );
  return {
    was,
    now,
    first,
    oldGoes: first || !elsewhere.has(entryKey(was)),
    newComes: first || !elsewhere.has(entryKey(now)),
  };
}

/** Everything the trade reads once its rows load. */
type Rows = {
  old: unknown;
  next: unknown;
  race: unknown;
  background: unknown;
  /** The starting class's row where it stays, and the multiclass rows of the others that stay. */
  starting: unknown[];
  entered: unknown[];
  skillHits: readonly SearchHit[];
  toolHits: readonly SearchHit[];
};

/** The trade a change makes: what leaves, what lands, what stays, and the lists the new class offers. */
function trade(definition: CharacterDefinition, change: Change, rows: Rows) {
  const { edition } = definition;
  const { was, now, first, oldGoes, newComes } = change;
  const { skillHits, toolHits } = rows;
  // A later level's class grants what a multiclass entry does, not what a starting class does.
  const read = (json: unknown) => (json && !first ? multiclassEntrySchema.parse(json) : json);
  const grantsOf = (cls: EntryRef, json: unknown) =>
    resolveGrants(
      catalogOf(cls) && json ? [classProficiencyGrantsSchema.parse(read(json))] : [],
      [],
      edition,
    );
  const still = leftInPlace(
    [rows.race, rows.background],
    rows.starting,
    rows.entered,
    skillHits,
    edition,
  );
  const wasGranted = oldGoes ? grantsOf(was, rows.old) : NO_GRANTS;
  const nowGranted = newComes ? grantsOf(now, rows.next) : NO_GRANTS;
  const taken = takenPicks({
    edition,
    old: oldGoes && catalogOf(was) ? read(rows.old) : undefined,
    background: rows.background,
    race: rows.race,
    skillHits,
    toolHits,
    granted: [wasGranted, still],
    held: definition.proficiencies,
  });
  const leaving = withPicks(wasGranted, taken.skills, taken.tools);
  const left = swapGrants(definition.proficiencies, leaving, nowGranted, still);
  return {
    leaving,
    nowGranted,
    still,
    ...offeredPicks({
      edition,
      json: newComes && catalogOf(now) ? read(rows.next) : undefined,
      skillHits,
      toolHits,
      held: left,
    }),
  };
}

/**
 * What `definition`'s class at `level` grants outright, what `now` would, and what the
 * sources the change leaves in place still grant: the race or subrace, the background, the
 * starting class and each other class's multiclass gains, so a proficiency one of them
 * grants stays, as creation keeps it. `swap` is `undefined` where the class is unchanged. A
 * homebrew row grants nothing.
 * Level 1 trades the starting class's grants. A later level trades multiclass gains: the old
 * class's go back only where this was its one level, and the new class's land only where the
 * character held none of it. The old class's skill and tool picks go back with its grants.
 * The new class's lists come back as `picks`, narrowed to what the character lacks once the
 * swap is made, as a multiclass entry's are, and `swap.now` holds the picks made so far.
 * `ready` is set once every list has as many picks as it asks.
 */
export function useClassChangeGrants(
  definition: CharacterDefinition,
  level: number,
  now: EntryRef | undefined,
) {
  const { edition, race, subrace, background } = definition;
  const change = classChange(definition, level, now);
  const swapping = change !== undefined;
  const old = useQuery(classQuery(change?.oldGoes ? catalogOf(change.was) : undefined));
  const next = useQuery(classQuery(change?.newComes ? catalogOf(change.now) : undefined));
  const catalogRace = swapping && "name" in race ? race : undefined;
  const raceRow = useRace(catalogRace);
  const subraces = useSubraces(subrace ? catalogRace : undefined, edition);
  const backgrounds = useBackgrounds(edition, swapping && "name" in background);
  const others = classLevels(definition).filter(
    (group) => change !== undefined && entryKey(group.class) !== entryKey(change.was),
  );
  const otherRows = useQueries({
    queries: others.map((group) => classQuery(swapping ? catalogOf(group.class) : undefined)),
  });
  // One edition holds at most 168 skill and language rows, and some fifty mundane tools,
  // each under the route's 200. Past that, a list leaves out the rows beyond the page.
  const names = useCatalogSearch({
    edition,
    type: "skill,language",
    query: "",
    listAll: swapping,
    limit: 200,
  });
  const tools = useCatalogSearch({
    edition,
    type: "item",
    query: "",
    listAll: swapping,
    limit: 200,
    filters: { kind: "tool", rarity: "none" },
  });
  const [made, setMade] = useState<MadePicks>();

  if (!change || !now)
    return { swap: undefined, read: true, failed: false, ready: true, picks: undefined };
  const raceJson = subrace
    ? subraces.data?.items.find((row) => sameRow(row, subrace))?.json
    : raceRow.data?.json;
  const backgroundJson =
    "name" in background
      ? backgrounds.data?.items.find((row) => sameRow(row, background))?.json
      : undefined;
  const startingKey = definition.levels[0] && entryKey(definition.levels[0].class);
  const rowsOf = (starting: boolean) =>
    others.flatMap((group, index) => {
      const json = otherRows[index]?.data?.json;
      return json && (entryKey(group.class) === startingKey) === starting ? [json] : [];
    });
  const { leaving, nowGranted, still, skillPick, toolPicks } = trade(definition, change, {
    old: old.data?.json,
    next: next.data?.json,
    race: raceJson,
    background: backgroundJson,
    starting: rowsOf(true),
    entered: rowsOf(false),
    skillHits: names.data?.items ?? [],
    toolHits: tools.data?.items ?? [],
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
    ...otherRows,
  ];
  return {
    swap: {
      was: leaving,
      now: withPicks(nowGranted, pickedSkills, pickedTools.flat()),
      still,
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
