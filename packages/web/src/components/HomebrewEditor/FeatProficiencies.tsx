import { FEAT_GRANT_SPECS } from "./featGrantShapes.ts";
import type { HomebrewFormProps } from "./homebrewEntry.ts";
import { ProficiencyFields } from "./ProficiencyFields.tsx";

export function FeatProficiencies(props: HomebrewFormProps) {
  return <ProficiencyFields {...props} specs={FEAT_GRANT_SPECS} />;
}
