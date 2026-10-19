import { rowPicks, spellDeparture, subclassPicks } from "./spellPicks.ts";
import { useCasterFacts } from "./useCasterFacts.ts";
import { useGrantedBy } from "./useGrantedBy.ts";
import { usePickedSpells } from "./usePickedSpells.ts";

/**
 * What the Spells step reads: what the class casts at its level, the spells its rows give
 * outright, the picks its subclass offers, the picks each other row offers apart from the
 * class's, each pick's level and standing on the list or offer it was made from, and the
 * note on any pick the rules would refuse. `tablesReady` is false until the class's tables
 * load, `ready` until everything has, `failed` true once any read fails, and `picked`
 * leaves out a pick still loading.
 */
export function useSpellChoices() {
  const caster = useCasterFacts();
  const { granted, offers, failed: grantsFailed } = useGrantedBy();
  const { picked, loading, failed: lookupFailed } = usePickedSpells(caster.list, offers);
  const subclass = subclassPicks(offers, caster.subclassStates, caster.facts?.prepares ?? false);
  const rows = rowPicks(offers, picked);
  const ready = caster.ready && !loading && granted !== undefined;
  return {
    ...caster,
    tablesReady: caster.ready,
    failed: caster.failed || lookupFailed || grantsFailed,
    ready,
    granted,
    subclass,
    rows,
    picked,
    note: ready
      ? spellDeparture(caster.facts, picked, caster.className, subclass, rows)
      : undefined,
  };
}
