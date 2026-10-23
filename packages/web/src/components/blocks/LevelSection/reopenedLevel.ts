import type { CharacterDefinition } from "@dnd/character";
import { type Granted, swapGrants } from "../../../lib/proficiencyGrants.ts";
import { spellsUnderClass } from "./spellsGained.ts";

/** What a new class trades: the old class's outright grants, the new one's, and the other sources'. */
export type ClassSwap = { was: Granted; now: Granted; still: Granted };

/**
 * `latest` with `level`'s choices made again as `values` holds them: the level-up form's
 * draft, whose levels end at `level`, its departures, which Apply sets to note each
 * multiclass prerequisite the picks leave unmet. Where the level changes class, `swap` trades
 * `latest`'s proficiencies, so a retried write never stacks a second swap on the first. The
 * levels after it stay as `latest` holds them, and so does every other field a level's picks
 * never write.
 */
export function withReopenedLevel(
  latest: CharacterDefinition,
  level: number,
  values: CharacterDefinition,
  swap?: ClassSwap,
): CharacterDefinition {
  const chosen = values.levels[level - 1];
  if (!chosen) return latest;
  return {
    ...latest,
    levels: latest.levels.map((each, index) => (index === level - 1 ? chosen : each)),
    feats: values.feats,
    abilityIncreases: values.abilityIncreases,
    featureChoices: values.featureChoices,
    spells: spellsUnderClass(values.spells, values.levels, chosen),
    optionalFeatures: values.optionalFeatures,
    proficiencies: swap
      ? swapGrants(latest.proficiencies, swap.was, swap.now, swap.still)
      : latest.proficiencies,
    departures: values.departures,
  };
}
