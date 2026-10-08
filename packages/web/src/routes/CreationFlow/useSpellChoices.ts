import { spellDeparture, subclassPicks } from "./spellPicks.ts";
import { useCasterFacts } from "./useCasterFacts.ts";
import { useGrantedBy } from "./useGrantedBy.ts";
import { usePickedSpells } from "./usePickedSpells.ts";

/**
 * What the Spells step reads: what the class casts at its level, the spells its rows give
 * outright, the picks its subclass offers, each pick's level and standing on the class's
 * list, and the note on any pick the rules would refuse. `tablesReady` is false until the
 * class's tables load, `ready` until everything has, `failed` true once any read fails,
 * and `picked` leaves out a pick still loading.
 */
export function useSpellChoices() {
  const caster = useCasterFacts();
  const { picked, loading, failed: lookupFailed } = usePickedSpells(caster.list);
  const { granted, offers, failed: grantsFailed } = useGrantedBy();
  const subclass = subclassPicks(offers, caster.subclassStates, caster.facts?.prepares ?? false);
  const ready = caster.ready && !loading && granted !== undefined;
  return {
    ...caster,
    tablesReady: caster.ready,
    failed: caster.failed || lookupFailed || grantsFailed,
    ready,
    granted,
    subclass,
    picked,
    note: ready ? spellDeparture(caster.facts, picked, caster.className, subclass) : undefined,
  };
}
