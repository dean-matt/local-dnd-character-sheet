import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { stepOf } from "./creationSteps.ts";
import { type EquipmentMemory, isComplete } from "./equipmentPicks.ts";
import { needed } from "./skillPicks.ts";
import { useHeldEquipment } from "./useHeldEquipment.ts";
import { useSkillTally } from "./useSkillTally.ts";

/**
 * Whether the Proficiencies & Equipment step is finished: Finish would find no fault in a
 * value it sets, every skill pick is spent as far as the grants leave room, and every
 * starting-equipment choice is made.
 */
export function useProficienciesDone(memory: EquipmentMemory | undefined): boolean {
  const values = useWatch<CharacterDefinition>();
  const skills = useSkillTally();
  const { sources, held } = useHeldEquipment(memory);
  const parsed = characterDefinitionSchema.safeParse(values);
  const faulted = parsed.error?.issues.some(
    (issue) => stepOf(String(issue.path[0] ?? ""))?.slug === "equipment",
  );
  if (faulted || skills === undefined || sources === undefined || held === undefined) return false;
  const granted = skills.granted.map((grant) => grant.ref);
  const spent = skills.offers.every(
    (offer, index) => (skills.tally.picked[index]?.length ?? 0) >= needed(offer, granted),
  );
  return spent && isComplete(sources, held);
}
