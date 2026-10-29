import { FeatGrantField } from "./FeatGrantField.tsx";
import { FEAT_GRANT_SPECS } from "./featGrantShapes.ts";
import { type HomebrewFormProps, withField } from "./homebrewEntry.ts";
import { ABILITY_OPTIONS } from "./homebrewOptions.ts";

/** The ability scores a homebrew feat raises and the saving throws it grants. */
export function FeatAbilityScores({ entry, onChange, errorFor }: HomebrewFormProps) {
  return (
    <div className="flex flex-col gap-4">
      {(
        [
          ["ability", "Ability score increases", "abilities"],
          ["savingThrowProficiencies", "Saving throws", "saving throws"],
        ] as const
      ).map(([key, label, noun]) => (
        <FeatGrantField
          key={key}
          label={label}
          noun={noun}
          options={ABILITY_OPTIONS}
          spec={FEAT_GRANT_SPECS[key]}
          value={entry[key]}
          onChange={(next) => onChange(withField(entry, key, next))}
          error={errorFor(key)}
        />
      ))}
    </div>
  );
}
