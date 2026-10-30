import { type ReactNode, useState } from "react";
import { FormField } from "../FormField.tsx";
import { InputField } from "../InputField.tsx";
import { MultiSelect } from "../MultiSelect.tsx";
import { Select } from "../Select.tsx";
import {
  type GrantMode,
  type GrantSpec,
  type GrantState,
  readGrant,
  writeGrant,
} from "./featGrantShapes.ts";
import { typedInteger } from "./homebrewEntry.ts";
import { FORM_GRID, PAIRED, SHORT } from "./homebrewGrid.ts";
import { type Option, withValues } from "./homebrewOptions.ts";

const MODES: { value: GrantMode; label: string }[] = [
  { value: "none", label: "None" },
  { value: "fixed", label: "Fixed" },
  { value: "list", label: "Choice from a list" },
  { value: "any", label: "Choice of any" },
];

export interface FeatGrantFieldProps {
  label: string;
  /** The plural the name list reads, such as "skills". */
  noun: string;
  options: Option[];
  spec: GrantSpec;
  /** The entry's field as it stands. */
  value: unknown;
  onChange: (next: unknown[] | undefined) => void;
  error?: ReactNode;
  /** Progress the user should hear, such as the options loading. */
  status?: ReactNode;
  /** What the entry is called where the form leaves a field to the JSON. */
  owner?: string;
  /** The ways to grant that the field offers; all four where absent. */
  modes?: GrantMode[];
}

/** The state a switch to `mode` starts from, carrying the names already picked. */
function switched(state: GrantState, mode: GrantMode): GrantState {
  const names = state.mode === "fixed" ? state.names : state.mode === "list" ? state.from : [];
  switch (mode) {
    case "none":
      return { mode };
    case "fixed":
      return { mode, names, amount: 1 };
    case "list":
      return { mode, from: names, count: 1 };
    case "any":
      return { mode, count: 1 };
  }
}

/**
 * One grant field of a feat or background: none, a fixed grant of the names picked, or a
 * choice the player makes on the sheet, from a list or of any, with how many they pick. A
 * field upstream writes as alternatives, or as a pick the form cannot show, stays in the
 * JSON. A name the options lack, pasted or not yet loaded, stays listed under its own
 * spelling.
 */
export function FeatGrantField({
  label,
  noun,
  options,
  spec,
  value,
  onChange,
  error,
  status,
  owner = "feat",
  modes,
}: FeatGrantFieldProps) {
  const [state, setState] = useState(() => readGrant(value, spec));
  if (!state) {
    return (
      <div className="flex flex-col">
        <span className="mb-1 text-muted text-row">{label}</span>
        <p className="text-muted text-row">
          This {owner} states its {label.toLowerCase()} as alternatives or a pick the form cannot
          show. Edit them in JSON.
        </p>
      </div>
    );
  }
  const write = (next: GrantState) => {
    setState(next);
    onChange(writeGrant(value, spec, next));
  };
  // A problem names the input it sits in, as `How many: …`, and shows beside that input.
  const errorAt = (input: string) =>
    typeof error === "string" && error.startsWith(`${input}:`) ? error : undefined;
  const modeError = errorAt("How many") || errorAt("Increase by") ? undefined : error;
  const named = state.mode === "fixed" ? state.names : state.mode === "list" ? state.from : [];
  const names = (namesLabel: string, onNames: (next: string[]) => void) => (
    <div className={PAIRED}>
      <MultiSelect
        inForm
        label={namesLabel}
        noun={noun}
        options={withValues(options, named)}
        selected={named}
        onChange={onNames}
      />
    </div>
  );
  const count = (current: number | null, onCount: (next: number | null) => void) => (
    <div className={SHORT}>
      <InputField
        label="How many"
        type="number"
        min={1}
        step={1}
        value={current ?? ""}
        error={errorAt("How many")}
        onChange={(event) => onCount(typedInteger(event.target.value) ?? null)}
      />
    </div>
  );

  if (spec.fixedOnly) {
    return (
      <div className={FORM_GRID}>
        {names(label, (next) => write({ mode: "fixed", names: next, amount: null }))}
        {status && (
          <p role="status" className="col-span-full text-muted text-row">
            {status}
          </p>
        )}
      </div>
    );
  }
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 font-semibold text-row">{label}</legend>
      <div className={FORM_GRID}>
        <div className={SHORT}>
          <FormField label="Granted as" error={modeError} status={status}>
            {(control) => (
              <Select
                {...control}
                options={modes ? MODES.filter(({ value }) => modes.includes(value)) : MODES}
                value={state.mode}
                onChange={(next) => write(switched(state, next as GrantMode))}
              />
            )}
          </FormField>
        </div>
        {state.mode === "fixed" && names("Granted", (next) => write({ ...state, names: next }))}
        {state.mode === "fixed" && spec.amounts && (
          <div className={SHORT}>
            <InputField
              label="Increase by"
              type="number"
              min={1}
              step={1}
              value={state.amount ?? ""}
              error={errorAt("Increase by")}
              onChange={(event) =>
                write({ ...state, amount: typedInteger(event.target.value) ?? null })
              }
            />
          </div>
        )}
        {state.mode === "list" && names("Choose from", (next) => write({ ...state, from: next }))}
        {(state.mode === "list" || state.mode === "any") &&
          count(state.count, (next) => write({ ...state, count: next }))}
      </div>
    </fieldset>
  );
}
