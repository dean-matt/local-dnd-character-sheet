import { ABILITIES, ABILITY_LABEL } from "@dnd/character";
import { FormField } from "../../components/FormField.tsx";
import { InputField } from "../../components/InputField.tsx";
import { Select } from "../../components/Select.tsx";
import { type HomebrewFormProps, textAt, withField } from "./homebrewEntry.ts";
import { FORM_GRID, PAIRED, SHORT } from "./homebrewGrid.ts";

const ABILITY_OPTIONS = ABILITIES.map((ability) => ({
  value: ability,
  label: ABILITY_LABEL[ability],
}));

/** A homebrew skill's first step: its name and the ability it uses. */
export function SkillBasics({ entry, onChange, errorFor }: HomebrewFormProps) {
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));

  return (
    <div className={FORM_GRID}>
      <div className={PAIRED}>
        <InputField
          label="Name"
          value={textAt(entry, "name")}
          onChange={(event) => set("name", event.target.value)}
          error={errorFor("name")}
        />
      </div>
      <div className={SHORT}>
        <FormField label="Ability" error={errorFor("ability")}>
          {(control) => (
            <Select
              {...control}
              options={ABILITY_OPTIONS}
              value={textAt(entry, "ability")}
              onChange={(next) => set("ability", next)}
            />
          )}
        </FormField>
      </div>
    </div>
  );
}
