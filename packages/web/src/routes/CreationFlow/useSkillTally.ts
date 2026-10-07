import type { CharacterDefinition } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { NO_GRANTS } from "./grants.ts";
import { tallySkills } from "./skillPicks.ts";
import { useSkillOffers } from "./useSkillOffers.ts";

/**
 * The skills granted and offered, and which offer each held skill spends, or `undefined`
 * while a row they read has not loaded.
 */
export function useSkillTally() {
  const proficiencies = useWatch<CharacterDefinition, "proficiencies">({ name: "proficiencies" });
  const found = useSkillOffers();
  if (found === undefined) return undefined;
  const skills = (proficiencies ?? NO_GRANTS).skills;
  const tally = tallySkills(
    found.offers,
    found.granted.map((grant) => grant.ref),
    skills.map((skill) => skill.ref),
  );
  return { ...found, skills, tally };
}
