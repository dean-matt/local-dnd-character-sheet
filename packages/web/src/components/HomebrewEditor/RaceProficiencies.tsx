import { RACE_GRANT_SPECS } from "./featGrantShapes.ts";
import type { HomebrewFormProps } from "./homebrewEntry.ts";
import { ProficiencyFields } from "./ProficiencyFields.tsx";

export function RaceProficiencies(props: HomebrewFormProps) {
  return <ProficiencyFields {...props} specs={RACE_GRANT_SPECS} owner="race" />;
}
