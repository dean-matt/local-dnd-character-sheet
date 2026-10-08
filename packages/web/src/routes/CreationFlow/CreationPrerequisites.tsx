import { ABILITIES, type Ability, abilityScore, type CharacterDefinition } from "@dnd/character";
import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { withPrerequisiteDepartures } from "./multiclassPrerequisites.ts";
import { useClassEntries } from "./useClassEntries.ts";

/**
 * Notes, as a departure, each class a multiclassed draft holds without the scores it needs
 * to multiclass, and drops the note once the scores or the classes change to meet it. It
 * runs on every step, since the Class step sets the classes and a later one the scores, and
 * judges nothing until every class's row has loaded and every score is set.
 */
export function CreationPrerequisites() {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const { entries } = useClassEntries();
  const [scores, increases] = useWatch<CharacterDefinition, ["abilityScores", "abilityIncreases"]>({
    name: ["abilityScores", "abilityIncreases"],
  });
  const set =
    scores !== undefined && ABILITIES.every((ability) => Number.isInteger(scores[ability]));
  const score = set
    ? (ability: Ability) =>
        abilityScore({ abilityScores: scores, abilityIncreases: increases ?? [] }, ability)
    : undefined;
  const read = entries.every((entry) => entry.read);
  const judged = entries.map(({ name, firstIndex, prerequisite }) => ({
    name,
    firstIndex,
    prerequisite,
  }));
  const key = JSON.stringify([judged, score && ABILITIES.map(score)]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `judged` and `score`, rebuilt each render.
  useEffect(() => {
    if (!read) return;
    const departures = getValues("departures");
    const next = withPrerequisiteDepartures(departures, judged, score);
    if (JSON.stringify(next) !== JSON.stringify(departures ?? []))
      setValue("departures", next, { shouldDirty: true });
  }, [key, read]);

  return null;
}
