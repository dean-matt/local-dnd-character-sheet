import { FormField } from "../../components/FormField.tsx";
import { InputField } from "../../components/InputField.tsx";
import { Select } from "../../components/Select.tsx";
import {
  type HomebrewFormProps,
  numberAt,
  textAt,
  typedNumber,
  withField,
} from "./homebrewEntry.ts";
import { FORM_GRID, SHORT, TEXT } from "./homebrewGrid.ts";
import { NOT_STATED, withCurrent } from "./homebrewOptions.ts";
import { GROUP_FIELDS, ITEM_TYPES, itemGroup } from "./homebrewVocabulary.ts";

/**
 * A homebrew item's first step: the fields every item carries. Picking a type in another group
 * drops the fields the old group carried.
 */
export function ItemBasics({ entry, onChange, errorFor }: HomebrewFormProps) {
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));
  const type = typeof entry.type === "string" ? (entry.type.split("|")[0] ?? "") : "";
  const group = itemGroup(entry.type);
  const value = numberAt(entry.value);
  return (
    <div className={FORM_GRID}>
      <div className={TEXT}>
        <InputField
          label="Name"
          value={textAt(entry, "name")}
          onChange={(event) => set("name", event.target.value)}
          error={errorFor("name")}
        />
      </div>
      <div className={SHORT}>
        <FormField label="Type" error={errorFor("type")}>
          {(control) => (
            <Select
              {...control}
              options={withCurrent([NOT_STATED, ...ITEM_TYPES], type)}
              value={type}
              onChange={(next) => {
                const left = itemGroup(next) === group ? [] : GROUP_FIELDS[group];
                const kept = Object.fromEntries(
                  Object.entries(entry).filter(([key]) => !left.includes(key)),
                );
                const suffix = typeof entry.type === "string" ? entry.type.split("|").slice(1) : [];
                onChange(withField(kept, "type", next ? [next, ...suffix].join("|") : undefined));
              }}
            />
          )}
        </FormField>
      </div>
      <div className={SHORT}>
        <InputField
          label="Weight (lb.)"
          type="number"
          min={0}
          step="any"
          value={numberAt(entry.weight) ?? ""}
          onChange={(event) => set("weight", typedNumber(event.target.value))}
        />
      </div>
      <div className={SHORT}>
        <InputField
          label="Value (gp)"
          type="number"
          min={0}
          step="any"
          value={value === undefined ? "" : value / 100}
          onChange={(event) => {
            const gp = typedNumber(event.target.value);
            set("value", gp === undefined ? undefined : Math.round(gp * 100));
          }}
        />
      </div>
    </div>
  );
}
