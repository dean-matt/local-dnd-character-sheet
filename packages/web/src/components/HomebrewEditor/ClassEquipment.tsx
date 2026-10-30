import { useState } from "react";
import { FormField } from "../FormField.tsx";
import { InputField } from "../InputField.tsx";
import { readEquipment, writeEquipment } from "./classShapes.ts";
import { HomebrewCheckbox } from "./HomebrewCheckbox.tsx";
import { type HomebrewFormProps, withField } from "./homebrewEntry.ts";
import { FORM_GRID, TEXT, WHOLE } from "./homebrewGrid.ts";

/**
 * A homebrew class's starting equipment: the choices it prints, one to a line, the gold taken
 * instead, and whether it comes on top of the background's. The text area keeps its own text,
 * read once on mount, so a blank line typed between two choices is not trimmed under the cursor.
 */
export function ClassEquipment({ entry, onChange, errorFor }: HomebrewFormProps) {
  const state = readEquipment(entry.startingEquipment);
  const [text, setText] = useState(state?.lines.join("\n") ?? "");
  if (!state) {
    return (
      <div className="flex flex-col">
        <span className="mb-1 text-muted text-row">Starting equipment</span>
        <p className="text-muted text-row">
          This class states its equipment in a shape the form cannot show. Edit it in JSON.
        </p>
      </div>
    );
  }
  const write = (next: typeof state) =>
    onChange(withField(entry, "startingEquipment", writeEquipment(entry.startingEquipment, next)));
  const error = errorFor("startingEquipment");
  return (
    <div className={FORM_GRID}>
      <div className={WHOLE}>
        <FormField label="Equipment choices, one to a line" error={error}>
          {(control) => (
            <textarea
              {...control}
              value={text}
              rows={5}
              onChange={(event) => {
                setText(event.target.value);
                write({
                  ...state,
                  lines: event.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean),
                });
              }}
              className="resize-y rounded-control border border-border bg-surface px-2 py-1 text-row aria-invalid:border-error"
            />
          )}
        </FormField>
      </div>
      <div className={TEXT}>
        <InputField
          label="Gold instead (GP)"
          value={state.gold}
          onChange={(event) => write({ ...state, gold: event.target.value })}
        />
      </div>
      <div className={WHOLE}>
        <HomebrewCheckbox
          label="In addition to what the background grants"
          checked={state.withBackground}
          onChange={(checked) => write({ ...state, withBackground: checked })}
        />
      </div>
    </div>
  );
}
