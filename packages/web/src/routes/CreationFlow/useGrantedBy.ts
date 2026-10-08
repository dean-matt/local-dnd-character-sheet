import { type ContentRef, refKey } from "@dnd/character";
import { useGrantedSpells } from "../../hooks/useGrantedSpells.ts";
import type { OtherPicks } from "./spellPicks.ts";
import { useSpellGrantors } from "./useSpellGrantors.ts";

/** A spell given outright, and the name of the row that gives it. */
export type GrantedSpell = { ref: ContentRef; by: string };

/**
 * The spells the draft's rows give outright by their levels, each once under the first row
 * that gives it, or `undefined` while any row's list loads; the picks the rows other than
 * the class offer; and whether any read failed.
 */
export function useGrantedBy(): {
  granted?: GrantedSpell[];
  others: OtherPicks;
  failed: boolean;
} {
  const grantors = useSpellGrantors();
  const { lists, failed } = useGrantedSpells(grantors);
  const seen = new Set<string>();
  const granted = lists?.flatMap(({ spells }, index) =>
    spells.flatMap((ref) => {
      if (seen.has(refKey(ref))) return [];
      seen.add(refKey(ref));
      return [{ ref, by: grantors[index]?.ref.name ?? "" }];
    }),
  );
  const others = (lists ?? []).reduce(
    (sum, { picks }, index) =>
      ["class", "subclass"].includes(grantors[index]?.grantor ?? "")
        ? sum
        : { cantrips: sum.cantrips + picks.cantrips, spells: sum.spells + picks.spells },
    { cantrips: 0, spells: 0 },
  );
  return { ...(granted && { granted }), others, failed };
}
