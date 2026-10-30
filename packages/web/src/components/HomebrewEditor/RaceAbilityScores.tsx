import { ABILITIES, ABILITY_LABEL } from "@dnd/character";
import { useState } from "react";
import { FormField } from "../FormField.tsx";
import { InputField } from "../InputField.tsx";
import { MultiSelect } from "../MultiSelect.tsx";
import { Select } from "../Select.tsx";
import { type HomebrewFormProps, typedInteger, withField } from "./homebrewEntry.ts";
import { FORM_GRID, PAIRED, SHORT } from "./homebrewGrid.ts";
import { ABILITY_OPTIONS } from "./homebrewOptions.ts";
import {
  type RaceAbilityMode,
  type RaceAbilityState,
  readRaceAbility,
  writeRaceAbility,
} from "./raceAbilityShapes.ts";

const MODES: { value: RaceAbilityMode; label: string }[] = [
  { value: "none", label: "None" },
  { value: "fixed", label: "Fixed" },
  { value: "choose", label: "Choice from a list" },
];

/** The state a switch to `mode` starts from, carrying the abilities already picked. */
function switched(state: RaceAbilityState, mode: RaceAbilityMode): RaceAbilityState {
  if (mode === "none") return { mode };
  if (mode === "fixed") return { mode, amounts: {} };
  return { mode, from: state.mode === "choose" ? state.from : [], count: 1, amount: 1 };
}

/**
 * The ability scores a homebrew race raises: each ability by its own amount, or a choice of
 * some abilities from a list. A field upstream writes as alternatives or a pick the form
 * cannot show stays in the JSON.
 */
export function RaceAbilityScores({ entry, onChange, errorFor }: HomebrewFormProps) {
  const [state, setState] = useState(() => readRaceAbility(entry.ability));
  const error = errorFor("ability");
  if (!state) {
    return (
      <div className="flex flex-col">
        <span className="mb-1 text-muted text-row">Ability score increases</span>
        <p className="text-muted text-row">
          This race states its ability score increases as alternatives or a pick the form cannot
          show. Edit them in JSON.
        </p>
      </div>
    );
  }
  const write = (next: RaceAbilityState) => {
    setState(next);
    onChange(withField(entry, "ability", writeRaceAbility(next)));
  };
  // A problem names the input it sits in, as `How many: …`, and shows beside that input.
  const errorAt = (input: string) =>
    typeof error === "string" && error.startsWith(`${input}:`) ? error : undefined;
  const modeError = errorAt("How many") || errorAt("Increase by") ? undefined : error;
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 font-semibold text-row">Ability score increases</legend>
      <div className={FORM_GRID}>
        <div className={SHORT}>
          <FormField label="Granted as" error={modeError}>
            {(control) => (
              <Select
                {...control}
                options={MODES}
                value={state.mode}
                onChange={(next) => write(switched(state, next as RaceAbilityMode))}
              />
            )}
          </FormField>
        </div>
        {state.mode === "fixed" &&
          ABILITIES.map((ability) => (
            <div key={ability} className={SHORT}>
              <InputField
                label={`${ABILITY_LABEL[ability]} increase`}
                type="number"
                step={1}
                value={state.amounts[ability] ?? ""}
                onChange={(event) => {
                  const { [ability]: _old, ...rest } = state.amounts;
                  const amount = typedInteger(event.target.value);
                  write({
                    mode: "fixed",
                    amounts: amount === undefined ? rest : { ...rest, [ability]: amount },
                  });
                }}
              />
            </div>
          ))}
        {state.mode === "choose" && (
          <>
            <div className={PAIRED}>
              <MultiSelect
                inForm
                label="Choose from"
                noun="abilities"
                options={ABILITY_OPTIONS}
                selected={state.from}
                onChange={(from) => write({ ...state, from })}
              />
            </div>
            <div className={SHORT}>
              <InputField
                label="How many"
                type="number"
                min={1}
                step={1}
                value={state.count ?? ""}
                error={errorAt("How many")}
                onChange={(event) =>
                  write({ ...state, count: typedInteger(event.target.value) ?? null })
                }
              />
            </div>
            <div className={SHORT}>
              <InputField
                label="Increase by"
                type="number"
                step={1}
                value={state.amount ?? ""}
                error={errorAt("Increase by")}
                onChange={(event) =>
                  write({ ...state, amount: typedInteger(event.target.value) ?? null })
                }
              />
            </div>
          </>
        )}
      </div>
    </fieldset>
  );
}
