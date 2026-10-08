import { type ContentRef, refKey } from "@dnd/character";
import { useGrantedSpells } from "../../hooks/useGrantedSpells.ts";
import { useSpellGrantors } from "./useSpellGrantors.ts";

/** A spell given outright, and the name of the row that gives it. */
export type GrantedSpell = { ref: ContentRef; by: string };

/**
 * The spells the draft's rows give outright by their levels, each once under the first row
 * that gives it, or `undefined` while any row's list loads; each row's offer of picks;
 * and whether any read failed.
 */
export function useGrantedBy(): {
  granted?: GrantedSpell[];
  offers: { grantor: string; picks: { cantrips: number; spells: number; alternatives: boolean } }[];
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
  const offers = (lists ?? []).map(({ picks }, index) => ({
    grantor: grantors[index]?.grantor ?? "",
    picks,
  }));
  return { ...(granted && { granted }), offers, failed };
}
