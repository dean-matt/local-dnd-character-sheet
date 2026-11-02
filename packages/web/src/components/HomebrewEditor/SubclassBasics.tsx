import { useParentClasses } from "../../hooks/useParentClasses.ts";
import { FormField } from "../FormField.tsx";
import { InputField } from "../InputField.tsx";
import { Select } from "../Select.tsx";
import { type HomebrewFormProps, textAt, withField } from "./homebrewEntry.ts";
import { FORM_GRID, PAIRED, WHOLE } from "./homebrewGrid.ts";

/** A homebrew subclass's name and the class of the draft's edition it belongs to. */
export function SubclassBasics({ entry, edition, onChange, errorFor }: HomebrewFormProps) {
  const { classes, pending, error } = useParentClasses(edition);
  const options = classes.map(({ parent, label }) => ({ value: JSON.stringify(parent), label }));
  const current = entry.parent === undefined ? "" : JSON.stringify(entry.parent);
  const known = options.some(({ value }) => value === current);
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
      <div className={PAIRED}>
        <FormField label="Parent class" error={errorFor("parent")}>
          {(control) => (
            <Select
              {...control}
              options={
                current && !known && !pending
                  ? [...options, { value: current, label: "A class not in this ruleset" }]
                  : options
              }
              value={current}
              onChange={(next) => onChange(withField(entry, "parent", JSON.parse(next)))}
            />
          )}
        </FormField>
      </div>
      {error && (
        <p role="alert" className={`${WHOLE} text-error text-row`}>
          Could not load the classes: {error.message}
        </p>
      )}
    </div>
  );
}
