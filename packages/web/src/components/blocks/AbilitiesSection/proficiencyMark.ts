import { type CharacterDefinition, PROFICIENCY_LEVELS } from "@dnd/character";

export type ProficiencyLevel = CharacterDefinition["proficiencies"]["skills"][number]["level"];

export const PROFICIENCY_MARK: Record<ProficiencyLevel, { text: string; className: string }> = {
  none: { text: "Not proficient", className: "border-muted" },
  half: {
    text: "Half proficiency",
    className: "border-accent bg-[linear-gradient(90deg,var(--color-accent)_50%,transparent_50%)]",
  },
  proficient: { text: "Proficient", className: "border-accent bg-accent" },
  expertise: {
    text: "Expertise",
    className: "border-accent bg-accent shadow-[inset_0_0_0_2px_var(--color-surface)]",
  },
};

/** A feature grants half proficiency rather than the player picking it, so the ring replaces it with the first pick, proficient. */
const NEXT_LEVEL: Record<ProficiencyLevel, ProficiencyLevel> = {
  none: "proficient",
  half: "proficient",
  proficient: "expertise",
  expertise: "none",
};

export const nextLevel = (level: ProficiencyLevel) => NEXT_LEVEL[level];

export const higherLevel = (a: ProficiencyLevel, b: ProficiencyLevel) =>
  PROFICIENCY_LEVELS.indexOf(b) > PROFICIENCY_LEVELS.indexOf(a) ? b : a;
