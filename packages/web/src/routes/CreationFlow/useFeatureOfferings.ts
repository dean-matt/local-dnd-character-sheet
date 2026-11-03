import { useQueries } from "@tanstack/react-query";
import { classGrantsQuery } from "../../hooks/classGrantsQuery.ts";
import { subclassGrantsQuery } from "../../hooks/subclassGrantsQuery.ts";
import { type FeatureOffering, featureOfferings } from "../../lib/featureOfferings.ts";
import type { ClassEntry } from "./useClassEntries.ts";

/**
 * What each of `entries` offers a choice of by its level, from its class and its subclass,
 * in the order of `entries`. `read` holds once every grant a class reads has settled; a
 * grant that failed to load offers nothing.
 */
export function useFeatureOfferings(entries: readonly ClassEntry[]): {
  offerings: FeatureOffering[][];
  read: boolean;
} {
  const level = (entry: ClassEntry) => Math.max(entry.level, 1);
  const classes = useQueries({
    queries: entries.map((entry) => classGrantsQuery(entry.catalogClass, level(entry))),
  });
  const subclasses = useQueries({
    queries: entries.map((entry) =>
      subclassGrantsQuery(entry.catalogClass, entry.subclassRow, level(entry)),
    ),
  });
  const offerings = entries.map((entry, index) => {
    if (entry.catalogClass === undefined) return [];
    const owner = { className: entry.catalogClass.name, classSource: entry.catalogClass.source };
    const row = entry.subclassRow;
    return [
      ...featureOfferings(classes[index]?.data?.features ?? [], owner),
      ...(row
        ? featureOfferings(subclasses[index]?.data?.features ?? [], {
            ...owner,
            subclass: { shortName: row.shortName, source: row.source },
          })
        : []),
    ];
  });
  const read = entries.every(
    (entry, index) =>
      entry.catalogClass === undefined ||
      (classes[index]?.isPending === false &&
        (entry.subclassRow === undefined || subclasses[index]?.isPending === false)),
  );
  return { offerings, read };
}
