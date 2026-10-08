import { CREATION_STEPS, type CreationStep } from "./creationSteps.ts";
import { useSpellChoices } from "./useSpellChoices.ts";

/**
 * The steps the rail lists and Next walks for this draft. A class that casts nothing at
 * its level skips Spells, so Finish moves to the step before it — unless its subclass
 * offers a pick there, a pick a changed class left behind needs clearing, or the flow
 * already stands on it. A pick a race, background or feat offers keeps no step.
 */
export function useCreationSteps(current: CreationStep): readonly CreationStep[] {
  const { ready, facts, picked, subclass } = useSpellChoices();
  const skipsSpells =
    ready &&
    facts === undefined &&
    subclass.cantrips + subclass.spells === 0 &&
    picked.length === 0 &&
    current.slug !== "spells";
  return skipsSpells ? CREATION_STEPS.filter((step) => step.slug !== "spells") : CREATION_STEPS;
}
