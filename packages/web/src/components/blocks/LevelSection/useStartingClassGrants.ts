import { classProficiencyGrantsSchema } from "@dnd/catalog";
import { type CharacterDefinition, type EntryRef, entryKey } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { classQuery } from "../../../hooks/classQuery.ts";
import { type Granted, NO_GRANTS, resolveGrants } from "../../../lib/proficiencyGrants.ts";

const catalogOf = (cls: EntryRef) => ("name" in cls ? cls : undefined);

/**
 * What the starting class `was` grants outright and what `now` would, read off each class's
 * own row as creation reads the first class's. `undefined` where the class is unchanged.
 * A homebrew class grants nothing. Skills resolve against no rows, as a multiclass entry's
 * do, since no class grants one outright.
 */
export function useStartingClassGrants(
  edition: CharacterDefinition["edition"],
  was: EntryRef | undefined,
  now: EntryRef | undefined,
) {
  const changed = was !== undefined && now !== undefined && entryKey(was) !== entryKey(now);
  const old = useQuery(classQuery(changed ? catalogOf(was) : undefined));
  const next = useQuery(classQuery(changed ? catalogOf(now) : undefined));
  const grantsOf = (cls: EntryRef, json: unknown): Granted =>
    catalogOf(cls) && json
      ? resolveGrants([classProficiencyGrantsSchema.parse(json)], [], edition)
      : NO_GRANTS;
  const settled = (cls: EntryRef, query: typeof old) => !catalogOf(cls) || query.isSuccess;
  if (!changed) return { swap: undefined, read: true, failed: false };
  return {
    swap: { was: grantsOf(was, old.data?.json), now: grantsOf(now, next.data?.json) },
    read: settled(was, old) && settled(now, next),
    failed: old.isError || next.isError,
  };
}
