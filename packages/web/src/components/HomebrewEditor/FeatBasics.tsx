import { InputField } from "../InputField.tsx";
import { type HomebrewFormProps, textAt, withField } from "./homebrewEntry.ts";
import { FORM_GRID, PAIRED } from "./homebrewGrid.ts";

/** The first step of a homebrew feat or background: its name. */
export function FeatBasics({ entry, onChange, errorFor }: HomebrewFormProps) {
  return (
    <div className={FORM_GRID}>
      <div className={PAIRED}>
        <InputField
          label="Name"
          value={textAt(entry, "name")}
          onChange={(event) => onChange(withField(entry, "name", event.target.value))}
          error={errorFor("name")}
        />
      </div>
    </div>
  );
}
