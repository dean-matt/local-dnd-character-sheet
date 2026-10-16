import { ABILITIES, ABILITY_LABEL, type Ability } from "@dnd/character";
import { type ReactNode, useState } from "react";
import { FormField } from "../../components/FormField.tsx";
import { InputField } from "../../components/InputField.tsx";
import { Select } from "../../components/Select.tsx";
import { isRecord } from "../../lib/entryGuards.ts";
import { HomebrewRowRemove } from "./HomebrewRowRemove.tsx";
import { numberAt, recordAt, typedInteger } from "./homebrewEntry.ts";
import { ROW, ROW_BUTTON } from "./homebrewRows.ts";

const ABILITY_OPTIONS = ABILITIES.map((value) => ({ value, label: ABILITY_LABEL[value] }));

const HOW_OPTIONS = [
  { value: "raise", label: "Raises by" },
  { value: "set", label: "Sets to" },
];

interface Change {
  ability: Ability;
  how: "raise" | "set";
  value: number | undefined;
}

export interface ItemAbilityFieldsProps {
  /** The entry's `ability`: a bonus per ability, and the scores `static` sets. */
  ability: unknown;
  onChange: (next: Record<string, unknown> | undefined) => void;
  error?: ReactNode;
}

function changesIn(grant: Record<string, unknown>): Change[] {
  const fixed = recordAt(grant, "static");
  return ABILITIES.flatMap((ability) => [
    ...(numberAt(grant[ability]) === undefined
      ? []
      : [{ ability, how: "raise" as const, value: numberAt(grant[ability]) }]),
    ...(numberAt(fixed[ability]) === undefined
      ? []
      : [{ ability, how: "set" as const, value: numberAt(fixed[ability]) }]),
  ]);
}

/**
 * One row per ability score the item raises or sets, as `ability` holds them: a raise under
 * the ability's own key, a set under `static`. A row with no number yet writes nothing, and
 * a later row for the same ability and rule wins. `max`, `choose` and any other key a pasted
 * entry carries survive an edit here.
 */
export function ItemAbilityFields({ ability, onChange, error }: ItemAbilityFieldsProps) {
  const grant = isRecord(ability) && !Array.isArray(ability) ? ability : {};
  const [rows, setRows] = useState(() => changesIn(grant));
  const write = (next: Change[]) => {
    setRows(next);
    const { static: _static, ...rest } = Object.fromEntries(
      Object.entries(grant).filter(([key]) => !(ABILITIES as readonly string[]).includes(key)),
    );
    const raised = next.filter((row) => row.how === "raise" && row.value !== undefined);
    const set = next.filter((row) => row.how === "set" && row.value !== undefined);
    const result = {
      ...rest,
      ...Object.fromEntries(raised.map((row) => [row.ability, row.value])),
      ...(set.length > 0 && {
        static: Object.fromEntries(set.map((row) => [row.ability, row.value])),
      }),
    };
    onChange(Object.keys(result).length > 0 ? result : undefined);
  };
  const replace = (index: number, change: Partial<Change>) =>
    write(rows.map((row, at) => (at === index ? { ...row, ...change } : row)));

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 text-muted text-row">Ability scores</legend>
      {rows.map((row, index) => {
        const label = `Ability change ${index + 1}`;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a row has no id, and the list only grows or shrinks at a row the user picked.
          <div key={index} className={ROW}>
            <FormField label={`${label} ability`} labelHidden>
              {(control) => (
                <Select
                  {...control}
                  options={ABILITY_OPTIONS}
                  value={row.ability}
                  onChange={(next) => replace(index, { ability: next as Ability })}
                />
              )}
            </FormField>
            <FormField label={`${label} rule`} labelHidden>
              {(control) => (
                <Select
                  {...control}
                  options={HOW_OPTIONS}
                  value={row.how}
                  onChange={(next) => replace(index, { how: next as Change["how"] })}
                />
              )}
            </FormField>
            <InputField
              label={`${label} amount`}
              labelHidden
              type="number"
              step={1}
              value={row.value ?? ""}
              onChange={(event) => replace(index, { value: typedInteger(event.target.value) })}
            />
            <div />
            <HomebrewRowRemove
              name={`ability change ${index + 1}`}
              onRemove={() => write(rows.filter((_, at) => at !== index))}
            />
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => setRows([...rows, { ability: "str", how: "raise", value: undefined }])}
        className={`self-start ${ROW_BUTTON}`}
      >
        Add an ability change
      </button>
      {error && (
        <p role="alert" className="text-error text-row">
          {error}
        </p>
      )}
    </fieldset>
  );
}
