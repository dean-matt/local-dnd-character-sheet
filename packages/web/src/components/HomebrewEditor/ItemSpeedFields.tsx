import { type ReactNode, useState } from "react";
import { isRecord } from "../../lib/entryGuards.ts";
import { FormField } from "../FormField.tsx";
import { InputField } from "../InputField.tsx";
import { Select } from "../Select.tsx";
import { HomebrewRowRemove } from "./HomebrewRowRemove.tsx";
import { numberAt, recordAt, typedInteger } from "./homebrewEntry.ts";
import { ROW, ROW_BUTTON } from "./homebrewRows.ts";

const MODES = [
  { value: "walk", label: "Walking" },
  { value: "fly", label: "Flying" },
  { value: "swim", label: "Swimming" },
  { value: "climb", label: "Climbing" },
  { value: "burrow", label: "Burrowing" },
];

const EVERY = { value: "*", label: "Every speed" };

const HOW_OPTIONS = [
  { value: "static", label: "Set to (ft.)" },
  { value: "bonus", label: "Raised by (ft.)" },
  { value: "equal", label: "Equal to" },
];

type How = "static" | "bonus" | "equal";

interface Change {
  mode: string;
  how: How;
  /** Feet for `static` and `bonus`, a mode for `equal`. */
  value: number | string | undefined;
}

export interface ItemSpeedFieldsProps {
  speed: unknown;
  onChange: (next: Record<string, unknown> | undefined) => void;
  error?: ReactNode;
}

function changesIn(modify: Record<string, unknown>): Change[] {
  return (["static", "bonus", "equal"] as const).flatMap((how) =>
    Object.entries(recordAt(modify, how)).map(([mode, value]) => ({
      mode,
      how,
      value: how === "equal" ? (typeof value === "string" ? value : undefined) : numberAt(value),
    })),
  );
}

/**
 * One row per speed the item sets, raises or matches to another, as `modifySpeed` holds
 * them. Every speed takes only a raise. A row with nothing to write yet writes nothing.
 * `multiply` has no control here, and survives an edit as a pasted entry holds it.
 */
export function ItemSpeedFields({ speed, onChange, error }: ItemSpeedFieldsProps) {
  const modify = isRecord(speed) && !Array.isArray(speed) ? speed : {};
  const [rows, setRows] = useState(() => changesIn(modify));
  const write = (next: Change[]) => {
    setRows(next);
    const { static: _s, bonus: _b, equal: _e, ...rest } = modify;
    const parts = Object.fromEntries(
      (["static", "bonus", "equal"] as const).flatMap((how) => {
        const part = Object.fromEntries(
          next
            .filter((row) => row.how === how && row.value !== undefined)
            .map((row) => [row.mode, row.value]),
        );
        return Object.keys(part).length > 0 ? [[how, part]] : [];
      }),
    );
    const result = { ...rest, ...parts };
    onChange(Object.keys(result).length > 0 ? result : undefined);
  };
  const replace = (index: number, change: Partial<Change>) =>
    write(rows.map((row, at) => (at === index ? { ...row, ...change } : row)));

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 text-muted text-row">Speed</legend>
      {rows.map((row, index) => {
        const label = `Speed change ${index + 1}`;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a row has no id, and the list only grows or shrinks at a row the user picked.
          <div key={index} className={ROW}>
            <FormField label={`${label} speed`} labelHidden>
              {(control) => (
                <Select
                  {...control}
                  options={[...MODES, EVERY]}
                  value={row.mode}
                  onChange={(mode) =>
                    replace(
                      index,
                      mode === "*" ? { mode, how: "bonus", value: undefined } : { mode },
                    )
                  }
                />
              )}
            </FormField>
            <FormField label={`${label} rule`} labelHidden>
              {(control) => (
                <Select
                  {...control}
                  options={row.mode === "*" ? HOW_OPTIONS.slice(1, 2) : HOW_OPTIONS}
                  value={row.how}
                  onChange={(how) => replace(index, { how: how as How, value: undefined })}
                />
              )}
            </FormField>
            {row.how === "equal" ? (
              <FormField label={`${label} matches`} labelHidden>
                {(control) => (
                  <Select
                    {...control}
                    options={[
                      { value: "", label: "Pick a speed" },
                      ...MODES.filter(({ value }) => value !== row.mode),
                    ]}
                    value={typeof row.value === "string" ? row.value : ""}
                    onChange={(value) => replace(index, { value: value || undefined })}
                  />
                )}
              </FormField>
            ) : (
              <InputField
                label={`${label} feet`}
                labelHidden
                type="number"
                step={5}
                value={typeof row.value === "number" ? row.value : ""}
                onChange={(event) => replace(index, { value: typedInteger(event.target.value) })}
              />
            )}
            <HomebrewRowRemove
              name={`speed change ${index + 1}`}
              onRemove={() => write(rows.filter((_, at) => at !== index))}
            />
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => setRows([...rows, { mode: "walk", how: "bonus", value: undefined }])}
        className={`self-start ${ROW_BUTTON}`}
      >
        Add a speed change
      </button>
      {error && (
        <p role="alert" className="text-error text-row">
          {error}
        </p>
      )}
    </fieldset>
  );
}
