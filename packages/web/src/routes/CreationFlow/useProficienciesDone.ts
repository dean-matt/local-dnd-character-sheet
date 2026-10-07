import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { stepOf } from "./creationSteps.ts";
import { type EquipmentMemory, isComplete } from "./equipmentPicks.ts";
import { skillsSpent } from "./skillPicks.ts";
import { useHeldEquipment } from "./useHeldEquipment.ts";
import { useSkillTally } from "./useSkillTally.ts";

/**
 * Whether the Proficiencies & Equipment step is finished: a class is chosen, Finish would
 * find no fault in a value it sets, every skill pick is spent as far as the grants leave
 * room, and every starting-equipment choice is made. Without a class, its missing picks and
 * equipment would read as every choice made.
 */
export function useProficienciesDone(memory: EquipmentMemory): boolean {
  const values = useWatch<CharacterDefinition>();
  const skills = useSkillTally();
  const { sources } = useHeldEquipment(memory);
  const parsed = characterDefinitionSchema.safeParse(values);
  const faulted = parsed.error?.issues.some(
    (issue) => stepOf(String(issue.path[0] ?? ""))?.slug === "equipment",
  );
  const classless = values.levels?.[0]?.class === undefined;
  if (classless || faulted || skills === undefined || sources === undefined) return false;
  return skillsSpent(skills.offers, skills.granted, skills.tally) && isComplete(sources, memory);
}
