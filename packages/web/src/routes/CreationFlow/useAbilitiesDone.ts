import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { stepOf } from "./creationSteps.ts";
import { isComplete, readPicks } from "./increasePicks.ts";
import { useIncreaseOptions } from "./useIncreaseOptions.ts";

/**
 * Whether the Ability Scores step is finished: Finish would find no fault in a value it
 * sets, and every increase the race and the background offer is placed.
 */
export function useAbilitiesDone(): boolean {
  const values = useWatch<CharacterDefinition>();
  const increases = useWatch<CharacterDefinition, "abilityIncreases">({ name: "abilityIncreases" });
  const sources = useIncreaseOptions();
  const parsed = characterDefinitionSchema.safeParse(values);
  const faulted = parsed.error?.issues.some(
    (issue) => stepOf(String(issue.path[0] ?? ""))?.slug === "abilities",
  );
  if (faulted || values.abilityScores === undefined || sources === undefined) return false;
  return sources.every(
    ({ grantedBy, alternatives }) =>
      alternatives.length === 0 ||
      isComplete(
        alternatives,
        readPicks(
          alternatives,
          (increases ?? []).filter((increase) => increase.grantedBy === grantedBy),
        ),
      ),
  );
}
