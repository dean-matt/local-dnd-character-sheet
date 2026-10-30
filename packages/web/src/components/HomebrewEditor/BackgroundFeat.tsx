import { useState } from "react";
import { useFeats } from "../../hooks/useFeats.ts";
import { FormField } from "../FormField.tsx";
import { MultiSelect } from "../MultiSelect.tsx";
import { Select } from "../Select.tsx";
import { type BackgroundFeatState, readFeats, writeFeats } from "./backgroundFeatShapes.ts";
import { type HomebrewFormProps, withField } from "./homebrewEntry.ts";
import { FORM_GRID, PAIRED, SHORT } from "./homebrewGrid.ts";
import { type Option, withValues } from "./homebrewOptions.ts";

const MODES = [
  { value: "none", label: "None" },
  { value: "fixed", label: "Fixed" },
  { value: "list", label: "Choice from a list" },
];

/**
 * The feat a homebrew background grants, or the feats it offers one of. The feats are the
 * edition's, loaded as the step opens. A field upstream writes as a pick from a category stays
 * in the JSON.
 */
export function BackgroundFeat({ entry, edition, onChange, errorFor }: HomebrewFormProps) {
  const feats = useFeats(edition);
  const [state, setState] = useState(() => readFeats(entry.feats));
  if (!state) {
    return (
      <div className="flex flex-col">
        <span className="mb-1 text-muted text-row">Feat</span>
        <p className="text-muted text-row">
          This background states its feat as a pick the form cannot show. Edit it in JSON.
        </p>
      </div>
    );
  }
  const options: Option[] = (feats.data?.items ?? []).map(({ name, source }) => ({
    value: `${name}|${source}`.toLowerCase(),
    label: `${name} (${source})`,
  }));
  const names = state.mode === "none" ? [] : state.names;
  const write = (next: BackgroundFeatState) => {
    setState(next);
    onChange(withField(entry, "feats", writeFeats(next)));
  };
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 font-semibold text-row">Feat</legend>
      <div className={FORM_GRID}>
        <div className={SHORT}>
          <FormField
            label="Granted as"
            error={errorFor("feats")}
            status={feats.isPending && "Loading the feats…"}
          >
            {(control) => (
              <Select
                {...control}
                options={MODES}
                value={state.mode}
                onChange={(mode) =>
                  write(mode === "none" ? { mode } : { mode: mode as "fixed" | "list", names })
                }
              />
            )}
          </FormField>
        </div>
        {state.mode !== "none" && (
          <div className={PAIRED}>
            <MultiSelect
              inForm
              label={state.mode === "fixed" ? "Granted" : "Choose from"}
              noun="feats"
              options={withValues(options, names)}
              selected={names}
              onChange={(next) => write({ mode: state.mode, names: next })}
            />
          </div>
        )}
      </div>
    </fieldset>
  );
}
