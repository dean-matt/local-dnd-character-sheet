import { CREATION_STEPS, type CreationStep } from "./creationSteps.ts";
import { useSpellChoices } from "./useSpellChoices.ts";

/**
 * The steps the rail lists and Next walks for this draft. A class that casts nothing at
 * its level skips Spells, so Finish moves to the step before it — unless another row, such
 * as a High Elf's race, offers a pick there, a pick a changed class left behind needs
 * clearing, or the flow already stands on it.
 */
export function useCreationSteps(current: CreationStep): readonly CreationStep[] {
  const { tablesReady, facts, picked, othersOffer } = useSpellChoices();
  const skipsSpells =
    tablesReady &&
    facts === undefined &&
    !othersOffer &&
    picked.length === 0 &&
    current.slug !== "spells";
  return skipsSpells ? CREATION_STEPS.filter((step) => step.slug !== "spells") : CREATION_STEPS;
}
