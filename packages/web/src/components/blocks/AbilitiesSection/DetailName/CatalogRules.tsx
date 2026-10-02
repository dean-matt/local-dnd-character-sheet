import { useMemo } from "react";
import { useResolvedRefs } from "../../../../hooks/useResolvedRefs.ts";
import { RulesEntries } from "../../../RulesEntries/RulesEntries.tsx";
import type { Rules } from "../abilityRules.ts";

/** The catalog's rules text for one row, or nothing where the catalog has none. */
export function CatalogRules({ tag, name, source }: Rules) {
  const refs = useMemo(() => [{ tag, name, source }], [tag, name, source]);
  const entries = useResolvedRefs(refs).data?.[0]?.entries;
  return entries && entries.length > 0 ? <RulesEntries entries={entries} /> : null;
}
