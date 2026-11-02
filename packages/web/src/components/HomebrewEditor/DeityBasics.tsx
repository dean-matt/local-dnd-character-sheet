import { InputField } from "../InputField.tsx";
import { type HomebrewFormProps, textAt, withField } from "./homebrewEntry.ts";
import { FORM_GRID, PAIRED } from "./homebrewGrid.ts";

/** A homebrew deity's name, the pantheon it belongs to, and its title. */
export function DeityBasics({ entry, onChange, errorFor }: HomebrewFormProps) {
  const text = (key: string, label: string) => (
    <div className={PAIRED}>
      <InputField
        label={label}
        value={textAt(entry, key)}
        onChange={(event) => onChange(withField(entry, key, event.target.value || undefined))}
        error={errorFor(key)}
      />
    </div>
  );
  return (
    <div className={FORM_GRID}>
      {text("name", "Name")}
      {text("pantheon", "Pantheon")}
      {text("title", "Title")}
    </div>
  );
}
