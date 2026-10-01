import type { CharacterDefinition } from "@dnd/character";

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
