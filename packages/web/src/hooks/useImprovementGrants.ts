import { type CharacterDefinition, type ContentRef, entryKey } from "@dnd/character";
import { useQueries } from "@tanstack/react-query";
import { type ImprovementGrant, improvementGrants } from "../lib/improvementGrants.ts";
import { classGrantsQuery } from "./classGrantsQuery.ts";

type Level = CharacterDefinition["levels"][number];

/**
 * Every improvement `levels` reaches, read off each catalog class's features at its level.
 * `read` holds once every class's features have loaded, a failed read excepted, since
 * reading it as no improvement would take back the choices made there. A homebrew class
 * carries no features, so it grants none.
 */
export function useImprovementGrants(levels: readonly Level[]): {
  grants: ImprovementGrant[];
  read: boolean;
} {
  const counts = new Map<string, { cls: ContentRef; level: number }>();
  for (const { class: cls } of levels) {
    if (!("name" in cls)) continue;
    const held = counts.get(entryKey(cls));
    counts.set(entryKey(cls), { cls, level: (held?.level ?? 0) + 1 });
  }
  const classes = [...counts.values()];
  const results = useQueries({
    queries: classes.map(({ cls, level }) => classGrantsQuery(cls, level)),
  });
  const features = new Map(
    classes.map(({ cls }, index) => [entryKey(cls), results[index]?.data?.features ?? []]),
  );
  return {
    grants: improvementGrants(levels, (cls) => features.get(entryKey(cls)) ?? []),
    read: results.every((result) => result.isSuccess),
  };
}
