import { ABILITIES, ABILITY_LABEL } from "@dnd/character";
import type { ReactNode } from "react";
import { FormField } from "../../components/FormField.tsx";
import { InputField } from "../../components/InputField.tsx";
import { Select } from "../../components/Select.tsx";
import { isRecord } from "../../lib/entryGuards.ts";
import { textAt } from "./homebrewEntry.ts";
import {
  ADVANTAGE_MODE_OPTIONS,
  ADVANTAGE_ROLL_OPTIONS,
  SKILL_NAMES,
} from "./homebrewVocabulary.ts";

const ANY_ABILITY = { value: "", label: "Any ability" };

const ABILITY_OPTIONS = [
  ANY_ABILITY,
  ...ABILITIES.map((ability) => ({ value: ability, label: ABILITY_LABEL[ability] })),
];

const SKILL_OPTIONS = SKILL_NAMES.map((name) => ({ value: name, label: name }));

type Effect = Record<string, unknown>;

/**
 * The advantage or disadvantage an item grants on a roll, one row per effect. Changing a
 * row's roll drops its target, since an ability and a skill name are not interchangeable.
 */
export function AdvantageFields({
  effects,
  onChange,
  error,
}: {
  effects: unknown[];
  onChange: (next: unknown[]) => void;
  error?: ReactNode;
}) {
  const rows: Effect[] = effects.map((effect) => (isRecord(effect) ? effect : {}));
  const replace = (index: number, change: Effect) =>
    onChange(
      rows.map((row, at) =>
        at === index
          ? Object.fromEntries(
              Object.entries({ ...row, ...change }).filter(([, v]) => v !== undefined),
            )
          : row,
      ),
    );

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 text-muted text-row">Advantage and disadvantage</legend>
      {rows.map((row, index) => {
        const roll = textAt(row, "roll");
        const label = `Effect ${index + 1}`;
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: a row has no id, and the list only grows or shrinks at a row the user picked.
            key={index}
            className="grid grid-cols-2 items-end gap-2 @2xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
          >
            <FormField label={`${label} mode`} labelHidden>
              {(control) => (
                <Select
                  {...control}
                  options={ADVANTAGE_MODE_OPTIONS}
                  value={textAt(row, "mode")}
                  onChange={(mode) => replace(index, { mode })}
                />
              )}
            </FormField>
            <FormField label={`${label} roll`} labelHidden>
              {(control) => (
                <Select
                  {...control}
                  options={ADVANTAGE_ROLL_OPTIONS}
                  value={roll}
                  onChange={(next) => replace(index, { roll: next, target: undefined })}
                />
              )}
            </FormField>
            {roll === "attack" ? (
              <div />
            ) : (
              <FormField label={`${label} ${roll === "skill" ? "skill" : "ability"}`} labelHidden>
                {(control) => (
                  <Select
                    {...control}
                    options={roll === "skill" ? SKILL_OPTIONS : ABILITY_OPTIONS}
                    value={textAt(row, "target")}
                    onChange={(target) => replace(index, { target: target || undefined })}
                  />
                )}
              </FormField>
            )}
            <InputField
              label={`${label} condition`}
              labelHidden
              placeholder="Condition, if any"
              value={textAt(row, "condition")}
              onChange={(event) => replace(index, { condition: event.target.value || undefined })}
            />
            <button
              type="button"
              onClick={() => onChange(effects.filter((_, at) => at !== index))}
              className="rounded-control border border-border bg-surface px-3 py-2 font-semibold text-ink text-row hover:bg-subtle"
            >
              Remove <span className="sr-only">effect {index + 1}</span>
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => onChange([...effects, { mode: "advantage", roll: "save" }])}
        className="self-start rounded-control border border-border bg-surface px-3 py-2 font-semibold text-ink text-row hover:bg-subtle"
      >
        Add an effect
      </button>
      {error && (
        <p role="alert" className="text-error text-row">
          {error}
        </p>
      )}
    </fieldset>
  );
}
