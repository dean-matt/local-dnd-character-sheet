import { FEAT_GRANT_SPECS } from "./featGrantShapes.ts";
import type { HomebrewFormProps } from "./homebrewEntry.ts";
import { ProficiencyFields } from "./ProficiencyFields.tsx";

/** The proficiencies a homebrew feat grants. */
export function FeatProficiencies(props: HomebrewFormProps) {
  return <ProficiencyFields {...props} specs={FEAT_GRANT_SPECS} />;
}
