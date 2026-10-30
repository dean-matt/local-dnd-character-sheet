import { FeatGrantField } from "./FeatGrantField.tsx";
import { BACKGROUND_GRANT_SPECS } from "./featGrantShapes.ts";
import { type HomebrewFormProps, withField } from "./homebrewEntry.ts";
import { ABILITY_OPTIONS } from "./homebrewOptions.ts";

/** The ability scores a homebrew background raises. */
export function BackgroundAbilityScores({ entry, onChange, errorFor }: HomebrewFormProps) {
  return (
    <FeatGrantField
      owner="background"
      label="Ability score increases"
      noun="abilities"
      options={ABILITY_OPTIONS}
      spec={BACKGROUND_GRANT_SPECS.ability}
      value={entry.ability}
      onChange={(next) => onChange(withField(entry, "ability", next))}
      error={errorFor("ability")}
    />
  );
}
