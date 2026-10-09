import { type CharacterDefinition, characterDefinitionSchema, improvementAt } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { useFeats } from "../../hooks/useFeats.ts";
import { useImprovementGrants } from "../../hooks/useImprovementGrants.ts";
import { isMade } from "../../lib/improvementChoice.ts";
import { isComplete, readPicks } from "../../lib/increasePicks.ts";
import { stepOf } from "./creationSteps.ts";
import { useIncreaseOptions } from "./useIncreaseOptions.ts";

/**
 * Whether the Ability Scores step is finished: Finish would find no fault in a value it
 * sets, every increase the race and the background offer is placed, and every
 * improvement the classes grant is made.
 */
export function useAbilitiesDone(): boolean {
  const values = useWatch<CharacterDefinition>();
  const [increases, levels = [], edition = "one", held = []] = useWatch<
    CharacterDefinition,
    ["abilityIncreases", "levels", "edition", "feats"]
  >({ name: ["abilityIncreases", "levels", "edition", "feats"] });
  const sources = useIncreaseOptions();
  const { grants, read } = useImprovementGrants(levels);
  const feats = useFeats(edition);
  const parsed = characterDefinitionSchema.safeParse(values);
  const faulted = parsed.error?.issues.some(
    (issue) => stepOf(String(issue.path[0] ?? ""))?.slug === "abilities",
  );
  if (faulted || values.abilityScores === undefined || sources === undefined) return false;
  const taken = { feats: held, abilityIncreases: increases ?? [] };
  const improved =
    read &&
    (grants.length === 0 ||
      (feats.isSuccess &&
        grants.every((grant) => isMade(improvementAt(taken, grant.level), feats.data.items))));
  return (
    improved &&
    sources.every(
      ({ grantedBy, alternatives }) =>
        alternatives.length === 0 ||
        isComplete(
          alternatives,
          readPicks(
            alternatives,
            (increases ?? []).filter((increase) => increase.grantedBy === grantedBy),
          ),
        ),
    )
  );
}
