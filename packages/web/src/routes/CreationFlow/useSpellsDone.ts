import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { stepOf } from "./creationSteps.ts";
import { spellsFilled } from "./spellPicks.ts";
import { useSpellChoices } from "./useSpellChoices.ts";

/**
 * Whether the Spells step is finished: a class is chosen, Finish would find no fault in a
 * value it sets, and the picks fill every count the class states and every pick another
 * row offers. A class that casts nothing, beside rows that offer nothing, has nothing to
 * choose, so it is finished once its rows load.
 */
export function useSpellsDone(): boolean {
  const values = useWatch<CharacterDefinition>();
  const { ready, facts, picked, others } = useSpellChoices();
  const parsed = characterDefinitionSchema.safeParse(values);
  const faulted = parsed.error?.issues.some(
    (issue) => stepOf(String(issue.path[0] ?? ""))?.slug === "spells",
  );
  if (!ready || faulted) return false;
  return spellsFilled(facts, picked, others);
}
