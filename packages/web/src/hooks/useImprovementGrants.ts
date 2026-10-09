import { type CharacterDefinition, classLevels, entryKey } from "@dnd/character";
import { useQueries } from "@tanstack/react-query";
import { type ImprovementGrant, improvementGrants } from "../lib/improvementGrants.ts";
import { classGrantsQuery } from "./classGrantsQuery.ts";
import { subclassGrantsQuery } from "./subclassGrantsQuery.ts";

type Level = CharacterDefinition["levels"][number];

/**
 * Every improvement `levels` reaches, read off each catalog class's features and its
 * subclass's at its level. `read` holds once every class's features have loaded, a failed
 * read excepted, since reading it as no improvement would take back the choices made
 * there. A homebrew class carries no features, so it grants none.
 */
export function useImprovementGrants(levels: readonly Level[]): {
  grants: ImprovementGrant[];
  read: boolean;
} {
  const classes = classLevels({ levels }).flatMap(({ class: cls, level, subclass }) =>
    "name" in cls ? [{ cls, level, subclass }] : [],
  );
  const results = useQueries({
    queries: classes.map(({ cls, level }) => classGrantsQuery(cls, level)),
  });
  const subclasses = useQueries({
    queries: classes.map(({ cls, level, subclass }) => subclassGrantsQuery(cls, subclass, level)),
  });
  const features = new Map(
    classes.map(({ cls }, index) => [
      entryKey(cls),
      [...(results[index]?.data?.features ?? []), ...(subclasses[index]?.data?.features ?? [])],
    ]),
  );
  return {
    grants: improvementGrants(levels, (cls) => features.get(entryKey(cls)) ?? []),
    read: results.every((result) => result.isSuccess),
  };
}
