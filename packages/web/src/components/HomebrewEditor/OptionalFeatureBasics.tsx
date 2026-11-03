import { useState } from "react";
import { FEATURE_TYPE_OPTIONS, featureTypeLabel } from "../../lib/featureTypeLabel.ts";
import { InputField } from "../InputField.tsx";
import { MultiSelect } from "../MultiSelect.tsx";
import { type HomebrewFormProps, listAt, textAt, withField } from "./homebrewEntry.ts";
import { FORM_GRID, PAIRED, TEXT } from "./homebrewGrid.ts";
import { ROW_BUTTON } from "./homebrewRows.ts";

/**
 * A homebrew optional feature's name and the feature types that offer it. A type is picked
 * from the ones the app names, or typed as a new code, which the API accepts as it is.
 */
export function OptionalFeatureBasics({ entry, onChange, errorFor }: HomebrewFormProps) {
  const [typed, setTyped] = useState("");
  const types = listAt(entry, "featureType").filter((each) => typeof each === "string");
  const options = [
    ...FEATURE_TYPE_OPTIONS,
    ...types
      .filter((type) => !FEATURE_TYPE_OPTIONS.some(({ value }) => value === type))
      .map((type) => ({ value: type, label: featureTypeLabel(type) })),
  ];
  const write = (next: string[]) =>
    onChange(withField(entry, "featureType", next.length > 0 ? next : undefined));
  const code = typed.trim();
  const add = () => {
    if (code && !types.includes(code)) write([...types, code]);
    setTyped("");
  };
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
          label="Feature types"
          noun="feature types"
          options={options}
          selected={types}
          onChange={write}
        />
        {errorFor("featureType")}
      </div>
      <div className={`${TEXT} flex items-end gap-2`}>
        <InputField
          label="New feature type"
          placeholder="XYZ"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            add();
          }}
        />
        <button type="button" onClick={add} disabled={!code} className={ROW_BUTTON}>
          Add feature type
        </button>
      </div>
    </div>
  );
}
