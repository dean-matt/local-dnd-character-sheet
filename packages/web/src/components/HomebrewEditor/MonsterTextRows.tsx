import { type ReactNode, useState } from "react";
import { InputField } from "../InputField.tsx";
import { HomebrewRowRemove } from "./HomebrewRowRemove.tsx";
import { ROW, ROW_BUTTON } from "./homebrewRows.ts";

export interface MonsterTextRowsProps {
  /** What one row is, singular and lowercase: `language`. */
  noun: string;
  legend: string;
  /** The rows to start with; the component holds them from there, so a blank one can wait. */
  initial: string[];
  /** Every row, blank ones included, after each change. */
  onChange: (rows: string[]) => void;
  error?: ReactNode;
}

/** One text input to a row with a remove button, and a button that adds a row. */
export function MonsterTextRows({ noun, legend, initial, onChange, error }: MonsterTextRowsProps) {
  const [rows, setRows] = useState(initial);
  const write = (next: string[]) => {
    setRows(next);
    onChange(next);
  };
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 text-muted text-row">{legend}</legend>
      {rows.map((row, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a row has no id, and the list only grows or shrinks at a row the user picked.
        <div key={index} className={ROW}>
          <InputField
            label={`${legend} ${index + 1}`}
            labelHidden
            value={row}
            onChange={(event) =>
              write(rows.map((each, at) => (at === index ? event.target.value : each)))
            }
          />
          <HomebrewRowRemove
            name={`${noun} ${index + 1}`}
            onRemove={() => write(rows.filter((_, at) => at !== index))}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => write([...rows, ""])}
        className={`self-start ${ROW_BUTTON}`}
      >
        Add a {noun}
      </button>
      {error && (
        <p role="alert" className="text-error text-row">
          {error}
        </p>
      )}
    </fieldset>
  );
}
