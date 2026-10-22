import type { CharacterDefinition } from "@dnd/character";
import { spellsUnderClass } from "./spellsGained.ts";

/**
 * `latest` with `level`'s choices made again as `values` holds them: the level-up form's
 * draft, whose levels end at `level`, its departures, which Apply sets to note each
 * multiclass prerequisite the picks leave unmet, and its proficiencies, which Apply swaps
 * where level 1 changes class. The levels after it stay as `latest` holds them, and so does
 * every other field a level's picks never write.
 */
export function withReopenedLevel(
  latest: CharacterDefinition,
  level: number,
  values: CharacterDefinition,
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
    proficiencies: values.proficiencies,
    departures: values.departures,
  };
}
