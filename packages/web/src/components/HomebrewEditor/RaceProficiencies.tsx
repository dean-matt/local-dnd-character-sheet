import { RACE_GRANT_SPECS } from "./featGrantShapes.ts";
import type { HomebrewFormProps } from "./homebrewEntry.ts";
import { ProficiencyFields } from "./ProficiencyFields.tsx";

/** The skills, tools, armor, weapons and languages a homebrew race grants. */
export function RaceProficiencies(props: HomebrewFormProps) {
  return <ProficiencyFields {...props} specs={RACE_GRANT_SPECS} owner="race" />;
}
