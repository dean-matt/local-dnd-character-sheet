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

/** Half proficiency comes from a feature rather than a pick, so the ring skips it and a stored half moves on to none. */
const LEVEL_CYCLE: ProficiencyLevel[] = ["none", "proficient", "expertise"];

export const nextLevel = (level: ProficiencyLevel) =>
  LEVEL_CYCLE[(LEVEL_CYCLE.indexOf(level) + 1) % LEVEL_CYCLE.length] ?? "none";
