import { type ReactNode, useState } from "react";
import { FormField } from "../../components/FormField.tsx";
import { InputField } from "../../components/InputField.tsx";
import { Select } from "../../components/Select.tsx";
import { HomebrewRowRemove } from "./HomebrewRowRemove.tsx";
import {
  type HomebrewFormProps,
  numberAt,
  signed,
  typedInteger,
  unsigned,
  withField,
} from "./homebrewEntry.ts";
import { ROW, ROW_BUTTON } from "./homebrewRows.ts";

/** Every bonus a row can set, and the label its picker shows. */
const BONUSES = [
  { value: "bonusWeapon", label: "Attack and damage" },
  { value: "bonusAc", label: "AC" },
  { value: "bonusSavingThrow", label: "Saving throws" },
  { value: "bonusSavingThrowConcentration", label: "Concentration saves" },
  { value: "bonusAbilityCheck", label: "Ability checks" },
  { value: "bonusProficiencyBonus", label: "Proficiency bonus" },
  { value: "bonusSpellAttack", label: "Spell attacks" },
  { value: "bonusSpellSaveDc", label: "Spell save DC" },
  { value: "bonusSpellDamage", label: "Spell damage" },
  { value: "critThreshold", label: "Critical hit on" },
];

/** `critThreshold` is a d20 roll held as a number; every other bonus is upstream's `+1`. */
const isRoll = (key: string) => key === "critThreshold";

const read = (key: string, value: unknown) => (isRoll(key) ? numberAt(value) : unsigned(value));

interface Row {
  key: string;
  value: number | undefined;
}

export interface ItemBonusFieldsProps extends Pick<HomebrewFormProps, "entry" | "onChange"> {
  /** Whether the item is a weapon, the only kind that takes a bonus to attack and damage. */
  weapon: boolean;
  error?: ReactNode;
}

/**
 * One row per bonus the item grants, each bonus in one row at most: a picker offers only
 * the bonuses no other row holds. A row with no number yet writes nothing, and changing a
 * row's bonus moves its number to the new field.
 */
export function ItemBonusFields({ entry, onChange, weapon, error }: ItemBonusFieldsProps) {
  const offered = BONUSES.filter(({ value }) => weapon || value !== "bonusWeapon");
  const [rows, setRows] = useState<Row[]>(() =>
    offered.flatMap(({ value: key }) => {
      const value = read(key, entry[key]);
      return value === undefined ? [] : [{ key, value }];
    }),
  );
  const write = (next: Row[]) => {
    setRows(next);
    let result = entry;
    for (const { value: key } of offered) {
      const row = next.find((each) => each.key === key);
      const value = row?.value;
      result = withField(result, key, isRoll(key) ? value : signed(value));
    }
    onChange(result);
  };
  const free = offered.filter(({ value }) => !rows.some((row) => row.key === value));

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 text-muted text-row">Bonuses</legend>
      {rows.map((row, index) => {
        const label = `Bonus ${index + 1}`;
        const roll = isRoll(row.key);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a row's bonus can change under it, and the list only grows or shrinks at a row the user picked.
          <div key={index} className={ROW}>
            <FormField label={`${label} to`} labelHidden>
              {(control) => (
                <Select
                  {...control}
                  options={offered.filter(
                    ({ value }) => value === row.key || !rows.some((each) => each.key === value),
                  )}
                  value={row.key}
                  onChange={(key) =>
                    write(rows.map((each, at) => (at === index ? { key, value: undefined } : each)))
                  }
                />
              )}
            </FormField>
            <InputField
              label={`${label} amount`}
              labelHidden
              type="number"
              step={1}
              min={roll ? 2 : undefined}
              max={roll ? 19 : undefined}
              placeholder={roll ? "19" : "+1"}
              value={row.value ?? ""}
              onChange={(event) =>
                write(
                  rows.map((each, at) =>
                    at === index ? { ...each, value: typedInteger(event.target.value) } : each,
                  ),
                )
              }
            />
            <div />
            <div />
            <HomebrewRowRemove
              name={`bonus ${index + 1}`}
              onRemove={() => write(rows.filter((_, at) => at !== index))}
            />
          </div>
        );
      })}
      {free[0] && (
        <button
          type="button"
          onClick={() => setRows([...rows, { key: free[0]?.value ?? "", value: undefined }])}
          className={`self-start ${ROW_BUTTON}`}
        >
          Add a bonus
        </button>
      )}
      {error && (
        <p role="alert" className="text-error text-row">
          {error}
        </p>
      )}
    </fieldset>
  );
}
