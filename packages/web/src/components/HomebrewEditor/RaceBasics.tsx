import { InputField } from "../InputField.tsx";
import { MultiSelect } from "../MultiSelect.tsx";
import { type HomebrewFormProps, listAt, textAt, withField } from "./homebrewEntry.ts";
import { FORM_GRID, PAIRED, WHOLE } from "./homebrewGrid.ts";
import { RACE_SIZES } from "./raceSizes.ts";

/** A homebrew race's name and the sizes it offers, which a character picks from where there are several. */
export function RaceBasics({ entry, onChange, errorFor }: HomebrewFormProps) {
  const sizes = listAt(entry, "size").filter((code): code is string => typeof code === "string");
  const error = errorFor("size");
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
        <MultiSelect
          inForm
          label="Size"
          noun="sizes"
          options={RACE_SIZES}
          selected={sizes}
          onChange={(next) =>
            onChange(
              withField(
                entry,
                "size",
                RACE_SIZES.map(({ value }) => value).filter((code) => next.includes(code)),
              ),
            )
          }
        />
      </div>
      {error && (
        <p role="alert" className={`${WHOLE} text-error text-row`}>
          {error}
        </p>
      )}
    </div>
  );
}
