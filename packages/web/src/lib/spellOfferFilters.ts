import type { SpellGrantorRef } from "../hooks/useGrantedSpells.ts";

const nameSource = (ref: { name: string; source: string }) => `${ref.name}|${ref.source}`;

/** The `/search` filters narrowing a picker to what the grantor leaves to a pick, none `offList`. */
export const spellOfferFilters = (
  { grantor, ref, parent, level, block }: SpellGrantorRef,
  offList: boolean,
) =>
  offList
    ? {}
    : {
        offerGrantor: grantor,
        offer: nameSource(ref),
        ...(parent && { offerParent: nameSource(parent) }),
        offerLevel: String(level),
        ...(block !== undefined && { offerBlock: String(block) }),
      };
