import { useMemo } from "react";
import { useResolvedRefs } from "../../../../hooks/useResolvedRefs.ts";
import { RulesEntries } from "../../../RulesEntries/RulesEntries.tsx";

/** The catalog's rules text for one standard action, or nothing where the catalog has none. */
export function ActionRules({ name, source }: { name: string; source: string }) {
  const refs = useMemo(() => [{ tag: "action", name, source }], [name, source]);
  const entries = useResolvedRefs(refs).data?.[0]?.entries;
  return entries && entries.length > 0 ? <RulesEntries entries={entries} /> : null;
}
