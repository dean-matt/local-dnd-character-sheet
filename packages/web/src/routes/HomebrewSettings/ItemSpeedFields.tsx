import type { ReactNode } from "react";
import { FormField } from "../../components/FormField.tsx";
import { InputField } from "../../components/InputField.tsx";
import { Select } from "../../components/Select.tsx";
import { isRecord } from "../../lib/entryGuards.ts";
import { numberAt, recordAt, typedInteger, withField } from "./homebrewEntry.ts";
import { FORM_GRID, SHORT } from "./homebrewGrid.ts";
import { NOT_STATED } from "./homebrewOptions.ts";

const MODES = [
  ["walk", "Walking"],
  ["fly", "Flying"],
  ["swim", "Swimming"],
  ["climb", "Climbing"],
  ["burrow", "Burrowing"],
] as const;

export interface ItemSpeedFieldsProps {
  /** The entry's `modifySpeed`. */
  speed: unknown;
  onChange: (next: Record<string, unknown> | undefined) => void;
  error?: ReactNode;
}

const orNothing = (record: Record<string, unknown>) =>
  Object.keys(record).length > 0 ? record : undefined;

/**
 * Feet added to every speed, then each speed's bonus, the speed it is set to, and the speed
 * it matches. `multiply` has no control here, and survives an edit as a pasted entry holds it.
 */
export function ItemSpeedFields({ speed, onChange, error }: ItemSpeedFieldsProps) {
  const modify = isRecord(speed) && !Array.isArray(speed) ? speed : {};
  const write = (part: string, mode: string, value: unknown) => {
    const next = orNothing(withField(recordAt(modify, part), mode, value));
    onChange(orNothing(withField(modify, part, next)));
  };
  const bonus = recordAt(modify, "bonus");
  const fixed = recordAt(modify, "static");
  const equal = recordAt(modify, "equal");
  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className="mb-1 text-muted text-row">Speed</legend>
      {error && <p className="text-error text-row">{error}</p>}
      <div className={FORM_GRID}>
        <div className={SHORT}>
          <InputField
            label="Bonus to every speed (ft.)"
            type="number"
            step={5}
            value={numberAt(bonus["*"]) ?? ""}
            onChange={(event) => write("bonus", "*", typedInteger(event.target.value))}
          />
        </div>
        <div className="hidden @2xl:col-span-3 @2xl:block" />
        {MODES.map(([mode, label]) => (
          <div key={mode} className="contents">
            <div className={SHORT}>
              <InputField
                label={`${label} bonus (ft.)`}
                type="number"
                step={5}
                value={numberAt(bonus[mode]) ?? ""}
                onChange={(event) => write("bonus", mode, typedInteger(event.target.value))}
              />
            </div>
            <div className={SHORT}>
              <InputField
                label={`${label} set to (ft.)`}
                type="number"
                min={0}
                step={5}
                value={numberAt(fixed[mode]) ?? ""}
                onChange={(event) => write("static", mode, typedInteger(event.target.value))}
              />
            </div>
            <div className={SHORT}>
              <FormField label={`${label} equal to`}>
                {(control) => (
                  <Select
                    {...control}
                    options={[
                      NOT_STATED,
                      ...MODES.filter(([other]) => other !== mode).map(([value, name]) => ({
                        value,
                        label: name,
                      })),
                    ]}
                    value={typeof equal[mode] === "string" ? (equal[mode] as string) : ""}
                    onChange={(next) => write("equal", mode, next || undefined)}
                  />
                )}
              </FormField>
            </div>
            <div className="hidden @2xl:block" />
          </div>
        ))}
      </div>
    </fieldset>
  );
}
