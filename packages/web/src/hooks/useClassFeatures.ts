import { type CharacterDefinition, classLevels, type EntryRef, entryKey } from "@dnd/character";
import { useQueries } from "@tanstack/react-query";
import type { ClassFeatures } from "../lib/levelHistory.ts";
import { classGrantsQuery } from "./classGrantsQuery.ts";
import { subclassGrantsQuery } from "./subclassGrantsQuery.ts";

type Level = CharacterDefinition["levels"][number];

/**
 * Every feature each catalog class in `levels` grants up to the level it reaches, and its
 * subclass's. `read` holds once every class's features have loaded. A homebrew class
 * carries no features, so `featuresOf` gives it none.
 */
export function useClassFeatures(levels: readonly Level[]): {
  featuresOf: (cls: EntryRef) => ClassFeatures;
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
      {
        class: results[index]?.data?.features ?? [],
        subclass: subclasses[index]?.data?.features ?? [],
      },
    ]),
  );
  return {
    featuresOf: (cls) => features.get(entryKey(cls)) ?? { class: [], subclass: [] },
    read: results.every((result) => result.isSuccess),
  };
}
