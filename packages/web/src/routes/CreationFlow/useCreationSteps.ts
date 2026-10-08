import { CREATION_STEPS, type CreationStep } from "./creationSteps.ts";
import { useSpellChoices } from "./useSpellChoices.ts";

/**
 * The steps the rail lists and Next walks for this draft. A class that casts nothing at
 * its level skips Spells, so Finish moves to the step before it — unless a pick a changed
 * class left behind needs clearing there, or the flow already stands on it.
 */
export function useCreationSteps(current: CreationStep): readonly CreationStep[] {
  const { tablesReady, facts, picked } = useSpellChoices();
  const skipsSpells =
    tablesReady && facts === undefined && picked.length === 0 && current.slug !== "spells";
  return skipsSpells ? CREATION_STEPS.filter((step) => step.slug !== "spells") : CREATION_STEPS;
}
