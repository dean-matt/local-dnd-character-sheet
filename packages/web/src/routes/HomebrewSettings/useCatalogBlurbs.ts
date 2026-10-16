import type { CharacterRecord } from "@dnd/character";
import { useMemo } from "react";
import { useResolvedRefs } from "../../hooks/useResolvedRefs.ts";
import { blurbOf } from "./catalogBlurb.ts";

/** The book each edition defines conditions and weapon properties in. */
const SOURCE: Record<CharacterRecord["edition"], string> = { classic: "PHB", one: "XPHB" };

/**
 * The first sentence of each of `names`' catalog text, as `{@tag name|source}` would open it,
 * in the book `edition` reads. A name the catalog lacks, or a catalog not built yet, has none.
 */
export function useCatalogBlurbs(
  tag: "itemProperty" | "condition",
  names: readonly string[],
  edition: CharacterRecord["edition"],
): Record<string, string> {
  const refs = useMemo(
    () => names.map((name) => ({ tag, name, source: SOURCE[edition] })),
    [tag, names, edition],
  );
  const { data } = useResolvedRefs(refs);
  return useMemo(() => {
    const blurbs: Record<string, string> = {};
    data?.forEach((row, at) => {
      const name = names[at];
      const blurb = row && blurbOf(row.entries);
      if (name !== undefined && blurb) blurbs[name] = blurb;
    });
    return blurbs;
  }, [data, names]);
}
