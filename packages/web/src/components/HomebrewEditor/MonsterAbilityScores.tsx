import { ABILITIES, ABILITY_LABEL } from "@dnd/character";
import { InputField } from "../InputField.tsx";
import { type HomebrewFormProps, typedInteger, withField } from "./homebrewEntry.ts";
import { FORM_GRID, SHORT } from "./homebrewGrid.ts";

/** A homebrew monster's six ability scores, each 1 to 30. */
export function MonsterAbilityScores({ entry, onChange, errorFor }: HomebrewFormProps) {
  return (
    <div className={FORM_GRID}>
      {ABILITIES.map((ability) => {
        const score = entry[ability];
        return (
          <div key={ability} className={SHORT}>
            <InputField
              label={ABILITY_LABEL[ability]}
              type="number"
              min={1}
              max={30}
              step={1}
              value={typeof score === "number" ? score : ""}
              onChange={(event) =>
                onChange(withField(entry, ability, typedInteger(event.target.value)))
              }
              error={errorFor(ability)}
            />
          </div>
        );
      })}
    </div>
  );
}
